import Foundation

public enum ZoidbergBotCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum ZoidbergBotCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum ZoidbergBotCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum ZoidbergBotCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct ZoidbergBotCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: ZoidbergBotCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: ZoidbergBotCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: ZoidbergBotCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: ZoidbergBotCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct ZoidbergBotCameraClipParams: Codable, Sendable, Equatable {
    public var facing: ZoidbergBotCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: ZoidbergBotCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: ZoidbergBotCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: ZoidbergBotCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
