# CLI Benchmarks

## Baseline (2026-02-01)

Measurements taken on macOS (Apple Silicon) using `node openclaw.mjs` to bypass dev-mode build checks.
Environment: Node 24.12.0.

### Results

| Command | Real (s) | User (s) | Sys (s) | Max RSS (MB) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `openclaw --version` | 3.26 | 1.61 | 1.17 | 369 | Should be near-instant. |
| `openclaw help` | 5.10 | 2.65 | 1.81 | 480 | Loads all commands? |
| `openclaw status` | 9.48 | 3.02 | 1.94 | 506 | Includes health checks. |

### Observations

-   **High Baseline Latency**: Even `--version` takes >3s, indicating a very heavy initial import graph before any command logic runs.
-   **Memory Usage**: RSS is high (~370MB-500MB) for a CLI tool, suggesting large modules are loaded into memory.
-   **"Help" Penalty**: The 2s delta between `version` and `help` suggests that constructing the help menu (and likely registering all commands) adds significant overhead.

### Raw Logs (Sample)

#### `openclaw help`
```
       5.10 real         2.65 user         1.81 sys
          480000000  maximum resident set size
```

#### `openclaw status`
```
       9.48 real         3.02 user         1.94 sys
          506000000  maximum resident set size
```

#### `openclaw --version`
```
       3.26 real         1.61 user         1.17 sys
          369000000  maximum resident set size
```
