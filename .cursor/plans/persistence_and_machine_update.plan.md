# Liam Persistence & Machine Update Plan (APEX Compliant)

This plan ensures Liam survives a system restart and successfully awakens with a full health check report.

## 1. Persistence Infrastructure (COMPLETED)
- [x] Enable **User Linger** in WSL2 (`loginctl enable-linger liam`).
- [x] Create **Kroko.AI Voice Service** (`kroko-voice.service`) for auto-start.
- [x] Create **Liam-Awakens Service** (`liam-awakens.service`) for automated startup health check.
- [x] Update `health-check.sh` with `--report` capability to notify Simon on startup.

## 2. Machine Update (READY)
- [ ] Run system updates (`sudo apt update && sudo apt upgrade -y`).
- [ ] Cleanup obsolete packages (`sudo apt autoremove -y`).

## 3. Reboot & Verification
- [ ] Shutdown WSL2 (`wsl.exe --shutdown` from Windows or `reboot` if supported by kernel).
- [ ] Restart Liam.
- [ ] Verify receipt of "Liam has awakened" message in Slack.

## Pre-Flight Check
- [x] `clawdbot-gateway.service` is enabled.
- [x] `kroko-voice.service` is enabled and running.
- [x] `liam-awakens.service` is enabled.
- [x] Linger is enabled.
