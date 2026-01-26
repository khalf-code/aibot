---
name: GitHub Fix and Voice Research (APEX compliant)
overview: Resolve GitHub CLI authentication persistence and research Whisper alternatives for low-latency capture.
todos:
  - id: gh-reset
    content: Reset gh state and verify config permissions
    status: completed
  - id: gh-auth-persist
    content: Perform persistent GitHub authentication (PAT fallback)
    status: in_progress
  - id: gh-monitor-impl
    content: Implement GitHub Activity Monitor skill
    status: pending
  - id: voice-benchmark
    content: Benchmark Kroko.AI vs Whisper.cpp for capture speed
    status: pending
isProject: false
---

# GitHub Persistence & Voice Research Plan

## Phase 1: GitHub CLI Persistence (APEX-4.4.1 compliant)

The `gh` CLI authentication is not persisting in WSL2. This is likely due to a broken credential helper or session handling in the interactive prompt.

### 1.1 Diagnosis & Reset

We will force `gh` to use file-based storage and clear any potentially corrupt state.

### 1.2 Bulletproof Authentication

Provide the user with a specific command to perform a non-interactive login using a Personal Access Token (PAT) as a fallback if the browser method fails again.

### 1.3 Monitoring Integration

Once authenticated, implement a proactive monitor for `Pastorsimon1798`.

## Phase 2: Whisper Alternatives Research

Simon needs <2s capture speed for neurodivergent support (NeuroSecond "Capture" stage).

### 2.1 Kroko.AI (Top Recommendation)

- **Small**: ~70MB model.
- **Fast**: 10x real-time on CPU (no GPU needed).
- **WSL2 Friendly**: Precompiled Linux binaries available.

### 2.2 Moonshine ASR

- **Edge-optimized**: High accuracy on lightweight hardware.
- **Community Backed**: 3.1k stars on GitHub.

### 2.3 Faster-Whisper-Plus

- **Speed**: significantly faster than base Whisper while maintaining accuracy.

---

## Actionable Todos

### Phase 1: GitHub Fix

- [ ] Reset `gh` state and verify `~/.config` permissions.
- [ ] Guide user through a "Force File" authentication flow.
- [ ] Create `~/clawdbot/skills/github-monitor/` with proactive activity checking.

### Phase 2: Voice Discovery

- [ ] Benchmark Kroko.AI binary in WSL2 environment.
- [ ] Propose update to [002] Whisper.cpp to switch to Kroko.AI if speed benchmarks pass.