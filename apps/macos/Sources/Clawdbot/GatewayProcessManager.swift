import Foundation
import Observation

@MainActor
@Observable
final class GatewayProcessManager {
    static let shared = GatewayProcessManager()

    enum Status: Equatable {
        case stopped
        case starting
        case running(details: String?)
        case attachedExisting(details: String?)
        case failed(String)

        var label: String {
            switch self {
            case .stopped: return "Stopped"
            case .starting: return "Starting…"
            case let .running(details):
                if let details, !details.isEmpty { return "Running (\(details))" }
                return "Running"
            case let .attachedExisting(details):
                if let details, !details.isEmpty {
                    return "Using existing gateway (\(details))"
                }
                return "Using existing gateway"
            case let .failed(reason): return "Failed: \(reason)"
            }
        }
    }

    private(set) var status: Status = .stopped {
        didSet { CanvasManager.shared.refreshDebugStatus() }
    }

    private(set) var log: String = ""
    private(set) var environmentStatus: GatewayEnvironmentStatus = .checking
    private(set) var existingGatewayDetails: String?
    private(set) var lastFailureReason: String?
    private var desiredActive = false
    private var environmentRefreshTask: Task<Void, Never>?
    private var lastEnvironmentRefresh: Date?
    private var logRefreshTask: Task<Void, Never>?
    private let logger = Logger(subsystem: "com.clawdbot", category: "gateway.process")

    // Fix #4: Crash counter with backoff
    private var recentFailures: [Date] = []
    private let maxFailures = 5
    private let crashWindow: TimeInterval = 60
    private var sweepTask: Task<Void, Never>?  // Fix #5: Periodic sweeps

    private let logLimit = 20000 // characters to keep in-memory
    private let environmentRefreshMinInterval: TimeInterval = 30

    func setActive(_ active: Bool) {
        // Remote mode should never spawn a local gateway; treat as stopped.
        if CommandResolver.connectionModeIsRemote() {
            self.desiredActive = false
            self.stop()
            self.status = .stopped
            self.appendLog("[gateway] remote mode active; skipping local gateway\n")
            self.logger.info("gateway process skipped: remote mode active")
            return
        }
        self.logger.debug("gateway active requested active=\(active)")
        self.desiredActive = active
        self.refreshEnvironmentStatus()
        if active {
            self.startIfNeeded()
        } else {
            self.stop()
        }
    }

    func ensureLaunchAgentEnabledIfNeeded() async {
        guard !CommandResolver.connectionModeIsRemote() else { return }
        guard !AppStateStore.attachExistingGatewayOnly else { return }
        let enabled = await GatewayLaunchAgentManager.isLoaded()
        guard !enabled else { return }
        let bundlePath = Bundle.main.bundleURL.path
        let port = GatewayEnvironment.gatewayPort()
        self.appendLog("[gateway] auto-enabling launchd job (\(gatewayLaunchdLabel)) on port \(port)\n")
        let err = await GatewayLaunchAgentManager.set(enabled: true, bundlePath: bundlePath, port: port)
        if let err {
            self.appendLog("[gateway] launchd auto-enable failed: \(err)\n")
        }
    }

    func startIfNeeded() {
        guard self.desiredActive else { return }
        // Do not spawn in remote mode (the gateway should run on the remote host).
        guard !CommandResolver.connectionModeIsRemote() else {
            self.status = .stopped
            self.stopPeriodicPortSweep()
            return
        }
        self.status = .starting
        self.logger.debug("gateway start requested")

        // Fix #5: Start periodic port cleanup sweeps
        self.startPeriodicPortSweep()

        // First try to latch onto an already-running gateway to avoid spawning a duplicate.
        Task { [weak self] in
            guard let self else { return }
            if await self.attachExistingGatewayIfAvailable() {
                return
            }
            // Respect debug toggle: only attach, never spawn, when enabled.
            // Fix #1: Auto-disable attach-only mode when no gateway is reachable.
            if AppStateStore.attachExistingGatewayOnly {
                await MainActor.run {
                    self.status = .failed("Attach-only enabled; no gateway to attach")
                    self.appendLog("[gateway] attach-only enabled; not spawning local gateway\n")
                    self.appendLog("[gateway] auto-disabling attach-only mode for recovery\n")
                    self.logger.warning("gateway attach-only auto-disable triggered")
                    AppStateStore.shared.attachExistingGatewayOnly = false
                }
                return
            }
            await self.enableLaunchdGateway()
        }
    }

    func stop() {
        self.desiredActive = false
        self.existingGatewayDetails = nil
        self.lastFailureReason = nil
        self.status = .stopped
        self.logger.info("gateway stop requested")
        self.stopPeriodicPortSweep()
        let bundlePath = Bundle.main.bundleURL.path
        Task {
            _ = await GatewayLaunchAgentManager.set(
                enabled: false,
                bundlePath: bundlePath,
                port: GatewayEnvironment.gatewayPort())
        }
    }

    func refreshEnvironmentStatus(force: Bool = false) {
        let now = Date()
        if !force {
            if self.environmentRefreshTask != nil { return }
            if let last = self.lastEnvironmentRefresh,
               now.timeIntervalSince(last) < self.environmentRefreshMinInterval
            {
                return
            }
        }
        self.lastEnvironmentRefresh = now
        self.environmentRefreshTask = Task { [weak self] in
            let status = await Task.detached(priority: .utility) {
                GatewayEnvironment.check()
            }.value
            await MainActor.run {
                guard let self else { return }
                self.environmentStatus = status
                self.environmentRefreshTask = nil
            }
        }
    }

    func refreshLog() {
        guard self.logRefreshTask == nil else { return }
        let path = LogLocator.launchdGatewayLogPath
        let limit = self.logLimit
        self.logRefreshTask = Task { [weak self] in
            let log = await Task.detached(priority: .utility) {
                Self.readGatewayLog(path: path, limit: limit)
            }.value
            await MainActor.run {
                guard let self else { return }
                if !log.isEmpty {
                    self.log = log
                }
                self.logRefreshTask = nil
            }
        }
    }

    // MARK: - Internals

    /// Attempt to connect to an already-running gateway on the configured port.
    /// If successful, mark status as attached and skip spawning a new process.
    private func attachExistingGatewayIfAvailable() async -> Bool {
        let port = GatewayEnvironment.gatewayPort()
        let instance = await PortGuardian.shared.describe(port: port)
        let instanceText = instance.map { self.describe(instance: $0) }
        let hasListener = instance != nil

        let attemptAttach = {
            try await GatewayConnection.shared.requestRaw(method: .health, timeoutMs: 2000)
        }

        for attempt in 0..<(hasListener ? 3 : 1) {
            do {
                let data = try await attemptAttach()
                let snap = decodeHealthSnapshot(from: data)
                let details = self.describe(details: instanceText, port: port, snap: snap)
                self.existingGatewayDetails = details
                self.status = .attachedExisting(details: details)
                self.appendLog("[gateway] using existing instance: \(details)\n")
                self.logger.info("gateway using existing instance details=\(details)")
                self.refreshControlChannelIfNeeded(reason: "attach existing")
                self.refreshLog()
                return true
            } catch {
                if attempt < 2, hasListener {
                    try? await Task.sleep(nanoseconds: 250_000_000)
                    continue
                }

                if hasListener {
                    let reason = self.describeAttachFailure(error, port: port, instance: instance)
                    self.existingGatewayDetails = instanceText
                    self.status = .failed(reason)
                    self.lastFailureReason = reason
                    self.appendLog("[gateway] existing listener on port \(port) but attach failed: \(reason)\n")
                    self.logger.warning("gateway attach failed reason=\(reason)")
                    return true
                }

                // No reachable gateway (and no listener) — fall through to spawn.
                self.existingGatewayDetails = nil
                return false
            }
        }

        self.existingGatewayDetails = nil
        return false
    }

    private func describe(details instance: String?, port: Int, snap: HealthSnapshot?) -> String {
        let instanceText = instance ?? "pid unknown"
        if let snap {
            let linkId = snap.providerOrder?.first(where: {
                if let summary = snap.providers[$0] { return summary.linked != nil }
                return false
            }) ?? snap.providers.keys.first(where: {
                if let summary = snap.providers[$0] { return summary.linked != nil }
                return false
            })
            let linked = linkId.flatMap { snap.providers[$0]?.linked } ?? false
            let authAge = linkId.flatMap { snap.providers[$0]?.authAgeMs }.flatMap(msToAge) ?? "unknown age"
            let label =
                linkId.flatMap { snap.providerLabels?[$0] } ??
                linkId?.capitalized ??
                "provider"
            let linkText = linked ? "linked" : "not linked"
            return "port \(port), \(label) \(linkText), auth \(authAge), \(instanceText)"
        }
        return "port \(port), health probe succeeded, \(instanceText)"
    }

    private func describe(instance: PortGuardian.Descriptor) -> String {
        let path = instance.executablePath ?? "path unknown"
        return "pid \(instance.pid) \(instance.command) @ \(path)"
    }

    // Fix #6: Improved attach-failure error messages with actionable context
    private func describeAttachFailure(_ error: Error, port: Int, instance: PortGuardian.Descriptor?) -> String {
        let ns = error as NSError
        let message = ns.localizedDescription.isEmpty ? "unknown error" : ns.localizedDescription
        let lower = message.lowercased()

        if self.isGatewayAuthFailure(error) {
            // Get the current token for comparison hint
            let currentTokenHint: String
            let root = ClawdbotConfigFile.loadDict()
            if let gateway = root["gateway"] as? [String: Any],
               let auth = gateway["auth"] as? [String: Any],
               let token = auth["token"] as? String, !token.isEmpty
            {
                let prefix = String(token.prefix(4))
                currentTokenHint = "Your token starts with '\(prefix)'. "
            } else if let envToken = ProcessInfo.processInfo.environment["CLAWDBOT_GATEWAY_TOKEN"], !envToken.isEmpty {
                let prefix = String(envToken.prefix(4))
                currentTokenHint = "Your env token starts with '\(prefix)'. "
            } else {
                currentTokenHint = "You have no token set. "
            }

            return """
            Gateway on port \(port) rejected auth.

            \(currentTokenHint)The running gateway requires a matching token.
            Either:
            • Set gateway.auth.token (or CLAWDBOT_GATEWAY_TOKEN) to match the running gateway
            • Or clear the token on the running gateway

            You can also run 'clawdbot doctor' to check configuration.
            """
        }

        if lower.contains("protocol mismatch") {
            let runningInfo = instance.map { " (pid \($0.pid))" } ?? ""
            return """
            Gateway on port \(port) is incompatible \(runningInfo).
            This usually means the app and gateway have different versions.
            Restart the app or run 'clawdbot doctor' to diagnose.
            """
        }

        if lower.contains("unexpected response") || lower.contains("invalid response") {
            guard let instance else {
                return "Port \(port) returned non-gateway data; another process is using it."
            }
            let instanceText = self.describe(instance: instance)
            return """
            Port \(port) returned non-gateway data (\(instanceText)).
            Another process is using this port.
            Run 'clawdbot doctor' or kill the conflicting process.
            """
        }

        if let instance {
            let instanceText = self.describe(instance: instance)
            let isNodeProcess = instance.command.lowercased().contains("node")
                || instance.command.lowercased().contains("clawdbot")
                || instance.executablePath?.contains("entry.js") ?? false

            if isNodeProcess {
                return """
                Gateway listener on port \(port) (\(instanceText)) isn't responding to health checks.
                The gateway may be starting up or crashed.
                Try waiting a moment, or run: kill \(instance.pid) to force a restart.
                """
            } else {
                return """
                Port \(port) has a non-gateway process: \(instanceText).
                This process should NOT be using the gateway port.
                Run: kill \(instance.pid) to remove it, then retry.
                """
            }
        }

        return "Gateway on port \(port) failed health check: \(message)"
    }

    private func isGatewayAuthFailure(_ error: Error) -> Bool {
        if let urlError = error as? URLError, urlError.code == .dataNotAllowed {
            return true
        }
        let ns = error as NSError
        if ns.domain == "Gateway", ns.code == 1008 { return true }
        let lower = ns.localizedDescription.lowercased()
        return lower.contains("unauthorized") || lower.contains("auth")
    }

    private func enableLaunchdGateway() async {
        self.existingGatewayDetails = nil

        // Fix #4: Check crash counter and stop if we've hit the limit
        self.recordFailure()
        if self.recentFailures.count >= self.maxFailures {
            await MainActor.run {
                self.status = .failed(
                    "Gateway crashed \(self.maxFailures) times in \(Int(self.crashWindow))s. " +
                    "Run 'clawdbot doctor' to diagnose and try quitting/restarting the app.")
            }
            self.logger.error("gateway crash limit reached; not restarting")
            return
        }

        let resolution = await Task.detached(priority: .utility) {
            GatewayEnvironment.resolveGatewayCommand()
        }.value
        await MainActor.run { self.environmentStatus = resolution.status }
        guard resolution.command != nil else {
            await MainActor.run {
                self.status = .failed(resolution.status.message)
            }
            self.logger.error("gateway command resolve failed: \(resolution.status.message)")
            return
        }

        let bundlePath = Bundle.main.bundleURL.path
        let port = GatewayEnvironment.gatewayPort()

        // Fix #2: Detect and kill conflicting gateway processes before starting
        if let existing = await PortGuardian.shared.describe(port: port) {
            let expectedCommands = ["node", "clawdbot", "tsx", "pnpm", "bun"]
            let cmdLower = existing.command.lowercased()
            let isExpected = expectedCommands.contains { cmdLower.contains($0) }
            // Check if this is an unexpected process OR a node process not using entry.js
            let isOurEntryJS = existing.executablePath?.contains("entry.js") == true
            if !isExpected || !isOurEntryJS {
                await MainActor.run {
                    self.appendLog("[gateway] found conflicting process on port \(port): \(existing.command)\n")
                    self.appendLog("[gateway]   pid \(existing.pid) @ \(existing.executablePath ?? "unknown path")\n")
                    self.appendLog("[gateway] killing conflicting process\n")
                }
                self.logger.warning("killing conflicting gateway pid \(existing.pid)")
                let killed = await PortGuardian.shared.kill(existing.pid)
                if !killed {
                    await MainActor.run {
                        self.appendLog("[gateway] failed to kill conflicting process pid \(existing.pid)\n")
                    }
                }
                // Give time for port to be released
                try? await Task.sleep(nanoseconds: 500_000_000)
            }
        }

        self.appendLog("[gateway] enabling launchd job (\(gatewayLaunchdLabel)) on port \(port)\n")
        self.logger.info("gateway enabling launchd port=\(port)")
        let err = await GatewayLaunchAgentManager.set(enabled: true, bundlePath: bundlePath, port: port)
        if let err {
            self.status = .failed(err)
            self.lastFailureReason = err
            self.logger.error("gateway launchd enable failed: \(err)")
            return
        }

        // Best-effort: wait for the gateway to accept connections.
        let deadline = Date().addingTimeInterval(6)
        while Date() < deadline {
            if !self.desiredActive { return }
            do {
                _ = try await GatewayConnection.shared.requestRaw(method: .health, timeoutMs: 1500)
                let instance = await PortGuardian.shared.describe(port: port)
                let details = instance.map { "pid \($0.pid)" }
                self.status = .running(details: details)
                self.logger.info("gateway started details=\(details ?? "ok")")

                // Fix #3: Remove disable-launchagent marker on successful startup
                await GatewayLaunchAgentManager.removeDisableMarker()

                // Fix #4: Clear failures on successful start
                await MainActor.run {
                    self.recentFailures.removeAll()
                }

                self.refreshControlChannelIfNeeded(reason: "gateway started")
                self.refreshLog()
                return
            } catch {
                try? await Task.sleep(nanoseconds: 400_000_000)
            }
        }

        self.status = .failed("Gateway did not start in time")
        self.lastFailureReason = "launchd start timeout"
        self.logger.warning("gateway start timed out")
    }

    // Fix #4: Record failure with crash window
    private func recordFailure() {
        self.recentFailures.append(Date())
        self.recentFailures.removeAll { Date().timeIntervalSince($0) > self.crashWindow }
    }

    // Fix #5: Periodic port cleanup sweeps
    private func startPeriodicPortSweep() {
        self.sweepTask?.cancel()
        self.sweepTask = Task.detached(priority: .utility) { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds
                guard !Task.isCancelled else { break }
                await PortGuardian.shared.sweep(mode: .local)
            }
        }
    }

    private func stopPeriodicPortSweep() {
        self.sweepTask?.cancel()
        self.sweepTask = nil
    }

    private func appendLog(_ chunk: String) {
        self.log.append(chunk)
        if self.log.count > self.logLimit {
            self.log = String(self.log.suffix(self.logLimit))
        }
    }

    private func refreshControlChannelIfNeeded(reason: String) {
        switch ControlChannel.shared.state {
        case .connected, .connecting:
            return
        case .disconnected, .degraded:
            break
        }
        self.appendLog("[gateway] refreshing control channel (\(reason))\n")
        self.logger.debug("gateway control channel refresh reason=\(reason)")
        Task { await ControlChannel.shared.configure() }
    }

    func waitForGatewayReady(timeout: TimeInterval = 6) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if !self.desiredActive { return false }
            do {
                _ = try await GatewayConnection.shared.requestRaw(method: .health, timeoutMs: 1500)
                return true
            } catch {
                try? await Task.sleep(nanoseconds: 300_000_000)
            }
        }
        self.appendLog("[gateway] readiness wait timed out\n")
        self.logger.warning("gateway readiness wait timed out")
        return false
    }

    func clearLog() {
        self.log = ""
        try? FileManager.default.removeItem(atPath: LogLocator.launchdGatewayLogPath)
        self.logger.debug("gateway log cleared")
    }

    func setProjectRoot(path: String) {
        CommandResolver.setProjectRoot(path)
    }

    func projectRootPath() -> String {
        CommandResolver.projectRootPath()
    }

    private nonisolated static func readGatewayLog(path: String, limit: Int) -> String {
        guard FileManager.default.fileExists(atPath: path) else { return "" }
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)) else { return "" }
        let text = String(data: data, encoding: .utf8) ?? ""
        if text.count <= limit { return text }
        return String(text.suffix(limit))
    }
}
