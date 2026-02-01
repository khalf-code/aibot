import Foundation
import Testing
@testable import ZoidbergBot

@Suite(.serialized)
struct ZoidbergBotConfigFileTests {
    @Test
    func configPathRespectsEnvOverride() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("zoidbergbot-config-\(UUID().uuidString)")
            .appendingPathComponent("zoidbergbot.json")
            .path

        await TestIsolation.withEnvValues(["ZOIDBERGBOT_CONFIG_PATH": override]) {
            #expect(ZoidbergBotConfigFile.url().path == override)
        }
    }

    @MainActor
    @Test
    func remoteGatewayPortParsesAndMatchesHost() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("zoidbergbot-config-\(UUID().uuidString)")
            .appendingPathComponent("zoidbergbot.json")
            .path

        await TestIsolation.withEnvValues(["ZOIDBERGBOT_CONFIG_PATH": override]) {
            ZoidbergBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "ws://gateway.ts.net:19999",
                    ],
                ],
            ])
            #expect(ZoidbergBotConfigFile.remoteGatewayPort() == 19999)
            #expect(ZoidbergBotConfigFile.remoteGatewayPort(matchingHost: "gateway.ts.net") == 19999)
            #expect(ZoidbergBotConfigFile.remoteGatewayPort(matchingHost: "gateway") == 19999)
            #expect(ZoidbergBotConfigFile.remoteGatewayPort(matchingHost: "other.ts.net") == nil)
        }
    }

    @MainActor
    @Test
    func setRemoteGatewayUrlPreservesScheme() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("zoidbergbot-config-\(UUID().uuidString)")
            .appendingPathComponent("zoidbergbot.json")
            .path

        await TestIsolation.withEnvValues(["ZOIDBERGBOT_CONFIG_PATH": override]) {
            ZoidbergBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "wss://old-host:111",
                    ],
                ],
            ])
            ZoidbergBotConfigFile.setRemoteGatewayUrl(host: "new-host", port: 2222)
            let root = ZoidbergBotConfigFile.loadDict()
            let url = ((root["gateway"] as? [String: Any])?["remote"] as? [String: Any])?["url"] as? String
            #expect(url == "wss://new-host:2222")
        }
    }

    @Test
    func stateDirOverrideSetsConfigPath() async {
        let dir = FileManager().temporaryDirectory
            .appendingPathComponent("zoidbergbot-state-\(UUID().uuidString)", isDirectory: true)
            .path

        await TestIsolation.withEnvValues([
            "ZOIDBERGBOT_CONFIG_PATH": nil,
            "ZOIDBERGBOT_STATE_DIR": dir,
        ]) {
            #expect(ZoidbergBotConfigFile.stateDirURL().path == dir)
            #expect(ZoidbergBotConfigFile.url().path == "\(dir)/zoidbergbot.json")
        }
    }
}
