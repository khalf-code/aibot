---
name: kroko-voice
description: Ultra-low latency (<2s) local speech-to-text using Kroko.AI. Optimized for neurodivergent quick-capture and real-time transcription on WSL2.
---

# Kroko Voice Skill

This skill provides a high-performance, local ASR (Automatic Speech Recognition) engine using Kroko.AI. It is the primary engine for Liam's "Voice Wake" and quick-capture capabilities, hitting the sub-2 second latency requirement for Simon's Second Brain.

## Architecture

- **Backend**: `kroko-onnx-online-websocket-server` running on port 6006.
- **Model**: `Kroko-EN-Community-128-L-Streaming-001.data` (English Community Model).
- **Runtime**: ONNX Runtime v1.17.1 (Linux amd64).

## Performance (WSL2)

- **Speed**: >10x real-time on CPU.
- **Latency**: Sub-200ms for incremental streaming, ~500ms for final phrase.
- **Resources**: Uses ~700MB RAM and 4 CPU threads.

## Management

Start the server:
```bash
# Set library path for ONNX
export LD_LIBRARY_PATH=/home/liam/clawdbot/downloads/onnxruntime-linux-x64-1.17.1/lib:$LD_LIBRARY_PATH

# Run in background
nohup /home/liam/clawdbot/downloads/kroko-onnx-online-websocket-server \
  --port=6006 \
  --model=/home/liam/clawdbot/models/Kroko-ASR/Kroko-EN-Community-128-L-Streaming-001.data \
  --num-threads=4 > /tmp/kroko.log 2>&1 &
```

Check status:
```bash
ss -tunlp | grep 6006
```

## Integration with NeuroSecond

Use this for:
1. **Instant Note Capture**: Transcribe voice thoughts in <2 seconds.
2. **Real-time Meetings**: Stream transcription directly into session logs.
3. **Voice Commands**: Low-latency intent parsing for PARA task management.
