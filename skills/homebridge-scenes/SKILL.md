---
name: homebridge-scenes
description: Trigger HomeKit scenes via Homebridge Config UI X API (accessory switches).
homepage: https://github.com/homebridge/homebridge-config-ui-x
metadata: {"clawdbot":{"requires":{"bins":["curl","jq"]}}}
---

# Homebridge Scenes

Use this skill to trigger HomeKit scenes by toggling the Homebridge accessories that represent them (usually virtual switches).

Prereqs
- Homebridge Config UI X is running (default port 8581).
- Homebridge is running with `insecure` mode enabled if you need to list/control accessories via the UI API.
- Each scene is mapped to an accessory (commonly a virtual switch) so it appears in `/api/accessories`.

Environment
- `HB_HOST` (homebridge hostname or IP)
- `HB_USER` / `HB_PASS` (UI login), or disable auth and use `auth/noauth`.

Auth
```bash
HB_BASE="http://$HB_HOST:8581/api"
TOKEN=$(curl -sS -X POST "$HB_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$HB_USER\",\"password\":\"$HB_PASS\"}" | jq -r '.accessToken')
```

No-auth token (only if auth disabled):
```bash
HB_BASE="http://$HB_HOST:8581/api"
TOKEN=$(curl -sS -X POST "$HB_BASE/auth/noauth" | jq -r '.accessToken')
```

List accessories (find the scene switch)
```bash
curl -sS "$HB_BASE/accessories" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.[] | {uniqueId, serviceName, serviceCharacteristics}'
```

Trigger a scene (toggle the accessory on)
```bash
curl -sS -X PUT "$HB_BASE/accessories/$UNIQUE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"characteristicType":"On","value":true}'
```

Optional: reset the switch so the scene can be triggered again
```bash
sleep 1
curl -sS -X PUT "$HB_BASE/accessories/$UNIQUE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"characteristicType":"On","value":false}'
```

Notes
- If `On` is not a valid characteristic, inspect `serviceCharacteristics` and use the correct `characteristicType` from the accessory output.
- Accessory listing/control requires Homebridge insecure mode. If disabled, ask an operator to enable it.
