import Foundation

public enum ZoidbergBotLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
