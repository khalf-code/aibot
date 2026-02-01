# Progress

## Phase 1: Analysis & Benchmarking

- Status: In Progress
- Started: 2026-02-01

## Log

- 2026-02-01: Established baseline benchmarks. `openclaw help` takes ~5.1s, `status` ~9.5s, `--version` ~3.3s. Build system adds significant overhead (up to 30s total). Recorded in `docs/analysis/cli-bottlenecks/benchmarks.md`.
- 2026-02-01: Performed deep dive into CLI startup path. Identified `status` command and `tryRouteCli` as key bottlenecks. Updated analysis doc.
- 2026-02-01: Documented architectural plan for Lazy Command Registry in `docs/analysis/cli-bottlenecks.md`.
- 2026-02-01: Initialized tracking for CLI Bottlenecks mission.
- 2026-02-01: Implemented build-time optimizations in `scripts/run-node.mjs`: switched to recursive `fs.readdir` for faster change detection and added direct `tsgo` binary invocation to bypass `pnpm` overhead.
- 2026-02-01: Fixed eager import bug in `command-registry.ts` where `memory-cli` was being loaded at the top level, defeating lazy loading.
- 2026-02-01: Verified performance improvements: `--version` 0.7s faster, `help` 1.5s faster (30%), `status` 3.7s faster (40%). Updated benchmarks doc.
- 2026-02-01: Added `scripts/benchmark-cli-load.sh` for automated regression testing of CLI startup time. Updated `docs/analysis/cli-bottlenecks.md` and benchmarks.
- 2026-02-01: Started iteration on instrumentation to identify remaining bottlenecks in the CLI boot process. Focus: "Slow path" (fallback when fast routing fails) and plugin loading overhead.
- 2026-02-01: Iteration 2: Identified and fixed deep eager imports in `register.agent.ts` and `helpers.ts` which were pulling in the entire channel stack (deps.ts) during boot. Refactored to lazy load dependencies. CLI version check reduced from 2.45s to 2.14s.
