# Tasks

- [x] Benchmark baseline load time <!-- id: 1 -->
    - [x] Run `time openclaw help`
    - [x] Run `time openclaw status`
    - [x] Create `docs/analysis/cli-bottlenecks/benchmarks.md`
- [ ] Refactor command registry <!-- id: 7 -->
    - [ ] Convert `src/cli/program/command-registry.ts` to use lazy imports
    - [ ] Isolate `status` command dependencies
- [ ] Optimize build-time penalties <!-- id: 2 -->
- [ ] Streamline subcommand registration <!-- id: 3 -->
- [ ] Reduce global registry imports <!-- id: 4 -->
- [ ] Test and validate improvements <!-- id: 5 -->
- [ ] Iterate on instrumentation <!-- id: 6 -->
