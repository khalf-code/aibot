import AudioToolbox
import AVFoundation
import Foundation
import OpenClawKit
import OSLog

/// A streaming MP3 player for MiniMax TTS.
/// Uses NSCondition instead of DispatchSemaphore to avoid deallocation crashes.
@MainActor
final class MiniMaxStreamingPlayer: NSObject {
    static let shared = MiniMaxStreamingPlayer()
    
    private let logger = Logger(subsystem: "ai.openclaw", category: "minimax.stream")
    private var playback: MiniMaxStreamingPlayback?
    
    /// Play a streaming MP3 audio stream
    func play(stream: AsyncThrowingStream<Data, Error>) async -> StreamingPlaybackResult {
        // Stop any existing playback
        stopInternal()
        
        let playback = MiniMaxStreamingPlayback(logger: logger)
        self.playback = playback
        
        return await withCheckedContinuation { continuation in
            playback.setContinuation(continuation)
            playback.start()
            
            Task.detached {
                do {
                    for try await chunk in stream {
                        playback.append(chunk)
                    }
                    playback.finishInput()
                } catch {
                    playback.fail(error)
                }
            }
        }
    }
    
    /// Stop playback and return interrupted position
    func stop() -> Double? {
        guard let playback else { return nil }
        let interruptedAt = playback.stop(immediate: true)
        finish(playback: playback, result: StreamingPlaybackResult(finished: false, interruptedAt: interruptedAt))
        return interruptedAt
    }
    
    private func stopInternal() {
        guard let playback else { return }
        let interruptedAt = playback.stop(immediate: true)
        finish(playback: playback, result: StreamingPlaybackResult(finished: false, interruptedAt: interruptedAt))
    }
    
    private func finish(playback: MiniMaxStreamingPlayback, result: StreamingPlaybackResult) {
        playback.finish(result)
        guard self.playback === playback else { return }
        self.playback = nil
    }
}

/// Internal streaming playback implementation using NSCondition for safe buffer management
final class MiniMaxStreamingPlayback: @unchecked Sendable {
    private static let bufferCount: Int = 3
    private static let bufferSize: Int = 32 * 1024
    
    private let logger: Logger
    private let stateLock = NSLock()  // For state management
    private let parseQueue = DispatchQueue(label: "minimax.stream.parse")
    
    // Use NSCondition for buffer management - safe to destroy anytime
    private let bufferCondition = NSCondition()
    
    private var continuation: CheckedContinuation<StreamingPlaybackResult, Never>?
    private var finished = false
    private var tearingDown = false
    
    private var audioFileStream: AudioFileStreamID?
    private var audioQueue: AudioQueueRef?
    private var audioFormat: AudioStreamBasicDescription?
    
    // Protected by bufferCondition
    private var availableBuffers: [AudioQueueBufferRef] = []
    
    private var currentBuffer: AudioQueueBufferRef?
    private var currentBufferSize: Int = 0
    private var currentPacketDescs: [AudioStreamPacketDescription] = []
    
    private var inputFinished = false
    private var allDataEnqueued = false  // True when all data has been enqueued to AudioQueue
    private var startRequested = false
    private var queueStarted = false
    private var sampleRate: Double = 0
    private var totalBytesReceived: Int = 0
    private var totalBytesEnqueued: Int = 0
    
    init(logger: Logger) {
        self.logger = logger
    }
    
    func setContinuation(_ continuation: CheckedContinuation<StreamingPlaybackResult, Never>) {
        stateLock.lock()
        self.continuation = continuation
        stateLock.unlock()
    }
    
    func start() {
        logger.info("MiniMax playback starting")
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        var stream: AudioFileStreamID?
        let status = AudioFileStreamOpen(
            selfPtr,
            { userData, streamID, propertyID, _ in
                let playback = Unmanaged<MiniMaxStreamingPlayback>.fromOpaque(userData).takeUnretainedValue()
                playback.handlePropertyChange(streamID: streamID, propertyID: propertyID)
            },
            { userData, numberBytes, numberPackets, inputData, packetDescriptions in
                let playback = Unmanaged<MiniMaxStreamingPlayback>.fromOpaque(userData).takeUnretainedValue()
                playback.handlePackets(
                    numberBytes: numberBytes,
                    numberPackets: numberPackets,
                    inputData: inputData,
                    packetDescriptions: packetDescriptions
                )
            },
            kAudioFileMP3Type,
            &stream
        )
        
        if status != noErr {
            logger.error("MiniMax stream open failed: \(status)")
            finish(StreamingPlaybackResult(finished: false, interruptedAt: nil))
            return
        }
        audioFileStream = stream
    }
    
    func append(_ data: Data) {
        guard !data.isEmpty else { return }
        totalBytesReceived += data.count
        
        parseQueue.async { [weak self] in
            guard let self, let stream = self.audioFileStream else { return }
            
            self.stateLock.lock()
            let tearing = self.tearingDown
            self.stateLock.unlock()
            if tearing { return }
            
            let status = data.withUnsafeBytes { bytes in
                AudioFileStreamParseBytes(stream, UInt32(bytes.count), bytes.baseAddress, [])
            }
            if status != noErr {
                self.logger.error("MiniMax stream parse failed: \(status)")
                self.fail(NSError(domain: "MiniMaxStream", code: Int(status)))
            }
        }
    }
    
    func finishInput() {
        logger.info("MiniMax finishInput called, totalBytesReceived=\(self.totalBytesReceived)")
        parseQueue.async { [weak self] in
            guard let self else { return }
            
            // First set inputFinished to stop accepting new data
            self.stateLock.lock()
            self.inputFinished = true
            self.stateLock.unlock()
            
            if self.audioQueue == nil {
                self.logger.warning("MiniMax finishInput: no audioQueue, finishing")
                self.finish(StreamingPlaybackResult(finished: false, interruptedAt: nil))
                return
            }
            
            // Enqueue any remaining data in currentBuffer
            self.enqueueCurrentBuffer(flushOnly: true)
            self.logger.info("MiniMax finishInput: enqueued final buffer, totalEnqueued=\(self.totalBytesEnqueued)")
            
            // NOW set allDataEnqueued - this is the signal for handlePlaybackStateChange
            // to know it's safe to finish when running == 0
            self.stateLock.lock()
            self.allDataEnqueued = true
            self.stateLock.unlock()
            
            // Don't stop immediately - let the queue finish playing
            // AudioQueueStop with immediate=false will wait for buffers to finish
            _ = self.stop(immediate: false)
        }
    }
    
    func fail(_ error: Error) {
        logger.error("MiniMax stream failed: \(error.localizedDescription, privacy: .public)")
        _ = stop(immediate: true)
        finish(StreamingPlaybackResult(finished: false, interruptedAt: nil))
    }
    
    func stop(immediate: Bool) -> Double? {
        guard let queue = audioQueue else { return nil }
        let interruptedAt = currentTimeSeconds()
        logger.info("MiniMax stop called, immediate=\(immediate)")
        AudioQueueStop(queue, immediate)
        return interruptedAt
    }
    
    func finish(_ result: StreamingPlaybackResult) {
        let cont: CheckedContinuation<StreamingPlaybackResult, Never>?
        stateLock.lock()
        if finished {
            stateLock.unlock()
            return
        }
        finished = true
        tearingDown = true
        cont = continuation
        continuation = nil
        stateLock.unlock()
        
        logger.info("MiniMax finish called, result.finished=\(result.finished)")
        
        // Wake up any waiting threads before teardown
        bufferCondition.lock()
        bufferCondition.broadcast()
        bufferCondition.unlock()
        
        cont?.resume(returning: result)
        teardown()
    }
    
    private func teardown() {
        logger.info("MiniMax teardown")
        
        // Signal any waiting threads again
        bufferCondition.lock()
        bufferCondition.broadcast()
        bufferCondition.unlock()
        
        if let queue = audioQueue {
            AudioQueueDispose(queue, true)
            audioQueue = nil
        }
        if let stream = audioFileStream {
            AudioFileStreamClose(stream)
            audioFileStream = nil
        }
        
        bufferCondition.lock()
        availableBuffers.removeAll()
        bufferCondition.unlock()
        
        currentBuffer = nil
        currentPacketDescs.removeAll()
    }
    
    private func isTearingDown() -> Bool {
        stateLock.lock()
        let value = tearingDown
        stateLock.unlock()
        return value
    }
    
    private func handlePropertyChange(streamID: AudioFileStreamID, propertyID: AudioFileStreamPropertyID) {
        if propertyID == kAudioFileStreamProperty_DataFormat {
            var format = AudioStreamBasicDescription()
            var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
            if AudioFileStreamGetProperty(streamID, propertyID, &size, &format) == noErr {
                audioFormat = format
                sampleRate = format.mSampleRate
                logger.info("MiniMax audio format: sampleRate=\(format.mSampleRate)")
                setupAudioQueue(format: format)
            }
        }
    }
    
    private func setupAudioQueue(format: AudioStreamBasicDescription) {
        guard audioQueue == nil else { return }
        
        var fmt = format
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        
        var queue: AudioQueueRef?
        let status = AudioQueueNewOutput(
            &fmt,
            { userData, _, buffer in
                guard let userData else { return }
                let playback = Unmanaged<MiniMaxStreamingPlayback>.fromOpaque(userData).takeUnretainedValue()
                playback.handleBufferComplete(buffer: buffer)
            },
            selfPtr,
            nil,
            nil,
            0,
            &queue
        )
        
        guard status == noErr, let queue else {
            logger.error("MiniMax queue create failed: \(status)")
            return
        }
        
        audioQueue = queue
        logger.info("MiniMax audio queue created")
        
        // Add property listener for playback state
        AudioQueueAddPropertyListener(queue, kAudioQueueProperty_IsRunning, { userData, queue, _ in
            guard let userData else { return }
            let playback = Unmanaged<MiniMaxStreamingPlayback>.fromOpaque(userData).takeUnretainedValue()
            playback.handlePlaybackStateChange(queue: queue)
        }, selfPtr)
        
        // Allocate buffers
        bufferCondition.lock()
        for _ in 0..<Self.bufferCount {
            var buffer: AudioQueueBufferRef?
            if AudioQueueAllocateBuffer(queue, UInt32(Self.bufferSize), &buffer) == noErr, let buffer {
                availableBuffers.append(buffer)
            }
        }
        logger.info("MiniMax allocated \(self.availableBuffers.count) buffers")
        bufferCondition.unlock()
    }
    
    /// Get a buffer, waiting if necessary using NSCondition
    private func getBuffer() -> AudioQueueBufferRef? {
        bufferCondition.lock()
        
        // Wait for a buffer to become available
        while availableBuffers.isEmpty {
            // Check teardown state without holding bufferCondition (avoid deadlock)
            bufferCondition.unlock()
            if isTearingDown() {
                return nil
            }
            bufferCondition.lock()
            
            if availableBuffers.isEmpty {
                // Wait with timeout to periodically check teardown
                let waitResult = bufferCondition.wait(until: Date().addingTimeInterval(0.1))
                if !waitResult && availableBuffers.isEmpty {
                    // Timeout - check teardown again
                    bufferCondition.unlock()
                    if isTearingDown() {
                        return nil
                    }
                    bufferCondition.lock()
                }
            }
        }
        
        let buffer = availableBuffers.popLast()
        bufferCondition.unlock()
        return buffer
    }
    
    private func handlePackets(
        numberBytes: UInt32,
        numberPackets: UInt32,
        inputData: UnsafeRawPointer,
        packetDescriptions: UnsafeMutablePointer<AudioStreamPacketDescription>?
    ) {
        if isTearingDown() { return }
        
        if audioQueue == nil, let format = audioFormat {
            setupAudioQueue(format: format)
        }
        guard audioQueue != nil else { return }
        
        // Get a buffer if needed
        if currentBuffer == nil {
            guard let buffer = getBuffer() else { return }
            currentBuffer = buffer
            currentBufferSize = 0
            currentPacketDescs.removeAll(keepingCapacity: true)
        }
        
        let bytes = inputData.assumingMemoryBound(to: UInt8.self)
        let packetCount = Int(numberPackets)
        
        for index in 0..<packetCount {
            if isTearingDown() { return }
            
            let packetOffset: Int
            let packetSize: Int
            
            if let packetDescriptions {
                packetOffset = Int(packetDescriptions[index].mStartOffset)
                packetSize = Int(packetDescriptions[index].mDataByteSize)
            } else {
                let size = Int(numberBytes) / packetCount
                packetOffset = index * size
                packetSize = size
            }
            
            if packetSize > Self.bufferSize { continue }
            
            // If current buffer is full, enqueue it and get a new one
            if currentBufferSize + packetSize > Self.bufferSize {
                enqueueCurrentBuffer()
                if isTearingDown() { return }
                
                // Get next buffer (wait if needed)
                guard let buffer = getBuffer() else { return }
                currentBuffer = buffer
                currentBufferSize = 0
                currentPacketDescs.removeAll(keepingCapacity: true)
            }
            
            guard let buffer = currentBuffer else { return }
            let dest = buffer.pointee.mAudioData.advanced(by: currentBufferSize)
            memcpy(dest, bytes.advanced(by: packetOffset), packetSize)
            
            let desc = AudioStreamPacketDescription(
                mStartOffset: Int64(currentBufferSize),
                mVariableFramesInPacket: 0,
                mDataByteSize: UInt32(packetSize)
            )
            currentPacketDescs.append(desc)
            currentBufferSize += packetSize
        }
    }
    
    private func enqueueCurrentBuffer(flushOnly: Bool = false) {
        if isTearingDown() { return }
        guard let queue = audioQueue, let buffer = currentBuffer else { return }
        guard currentBufferSize > 0 else { return }
        
        buffer.pointee.mAudioDataByteSize = UInt32(currentBufferSize)
        let packetCount = UInt32(currentPacketDescs.count)
        
        let status = currentPacketDescs.withUnsafeBufferPointer { descPtr in
            AudioQueueEnqueueBuffer(queue, buffer, packetCount, descPtr.baseAddress)
        }
        
        if status == noErr {
            totalBytesEnqueued += currentBufferSize
            if !startRequested {
                startRequested = true
                let startStatus = AudioQueueStart(queue, nil)
                if startStatus == noErr {
                    queueStarted = true
                    logger.info("MiniMax audio queue started")
                } else {
                    logger.error("MiniMax queue start failed: \(startStatus)")
                }
            }
        } else {
            logger.error("MiniMax queue enqueue failed: \(status)")
        }
        
        currentBuffer = nil
        currentBufferSize = 0
        currentPacketDescs.removeAll(keepingCapacity: true)
    }
    
    private func handleBufferComplete(buffer: AudioQueueBufferRef) {
        bufferCondition.lock()
        availableBuffers.append(buffer)
        bufferCondition.signal()  // Wake up one waiting thread
        bufferCondition.unlock()
    }
    
    private func handlePlaybackStateChange(queue: AudioQueueRef) {
        var running: UInt32 = 0
        var size = UInt32(MemoryLayout<UInt32>.size)
        AudioQueueGetProperty(queue, kAudioQueueProperty_IsRunning, &running, &size)
        
        stateLock.lock()
        let dataEnqueued = allDataEnqueued  // Use allDataEnqueued, not inputFinished
        let wasStarted = queueStarted
        stateLock.unlock()
        
        logger.info("MiniMax playback state: running=\(running), allDataEnqueued=\(dataEnqueued), wasStarted=\(wasStarted)")
        
        // Only finish when: queue stopped AND all data has been enqueued AND queue was actually started
        if running == 0 && dataEnqueued && wasStarted {
            logger.info("MiniMax playback completed naturally")
            finish(StreamingPlaybackResult(finished: true, interruptedAt: nil))
        }
    }
    
    private func currentTimeSeconds() -> Double? {
        guard let queue = audioQueue, sampleRate > 0 else { return nil }
        var timeStamp = AudioTimeStamp()
        let status = AudioQueueGetCurrentTime(queue, nil, &timeStamp, nil)
        if status != noErr { return nil }
        if timeStamp.mSampleTime.isNaN { return nil }
        return timeStamp.mSampleTime / sampleRate
    }
}
