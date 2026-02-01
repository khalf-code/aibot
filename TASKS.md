# Tasks

- [x] Benchmark baseline load time <!-- id: 1 -->
  - [x] Run `time openclaw help`
  - [x] Run `time openclaw status`
  - [x] Create `docs/analysis/cli-bottlenecks/benchmarks.md`
- [x] Analyze import graph to find eager loading culprits <!-- id: 3 -->
- [x] Refactor command registry <!-- id: 7 -->
  - [x] Convert `src/cli/program/command-registry.ts` to use lazy imports
  - [x] Isolate `status` command dependencies
- [x] Optimize build-time penalties <!-- id: 2 -->
- [x] Streamline subcommand registration <!-- id: 3 -->
- [x] Reduce global registry imports <!-- id: 4 -->
- [x] Test and validate improvements <!-- id: 5 -->
- [x] Iterate on instrumentation <!-- id: 6 -->
  - [x] Add boot timing logs behind `OPENCLAW_DEBUG_BOOT`
  - [x] Measure cost of `registerProgramCommands`
  - [x] Measure cost of plugin loading in fallback path
