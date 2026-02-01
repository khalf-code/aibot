import Foundation

public enum ZoidbergBotChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(ZoidbergBotChatEventPayload)
    case agent(ZoidbergBotAgentEventPayload)
    case seqGap
}

public protocol ZoidbergBotChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> ZoidbergBotChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [ZoidbergBotChatAttachmentPayload]) async throws -> ZoidbergBotChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> ZoidbergBotChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<ZoidbergBotChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension ZoidbergBotChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "ZoidbergBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> ZoidbergBotChatSessionsListResponse {
        throw NSError(
            domain: "ZoidbergBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
