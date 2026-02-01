// swift-tools-version: 6.2
// Package manifest for the ZoidbergBot macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "ZoidbergBot",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "ZoidbergBotIPC", targets: ["ZoidbergBotIPC"]),
        .library(name: "ZoidbergBotDiscovery", targets: ["ZoidbergBotDiscovery"]),
        .executable(name: "ZoidbergBot", targets: ["ZoidbergBot"]),
        .executable(name: "zoidbergbot-mac", targets: ["ZoidbergBotMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/ZoidbergBotKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "ZoidbergBotIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ZoidbergBotDiscovery",
            dependencies: [
                .product(name: "ZoidbergBotKit", package: "ZoidbergBotKit"),
            ],
            path: "Sources/ZoidbergBotDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "ZoidbergBot",
            dependencies: [
                "ZoidbergBotIPC",
                "ZoidbergBotDiscovery",
                .product(name: "ZoidbergBotKit", package: "ZoidbergBotKit"),
                .product(name: "ZoidbergBotChatUI", package: "ZoidbergBotKit"),
                .product(name: "ZoidbergBotProtocol", package: "ZoidbergBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/ZoidbergBot.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "ZoidbergBotMacCLI",
            dependencies: [
                "ZoidbergBotDiscovery",
                .product(name: "ZoidbergBotKit", package: "ZoidbergBotKit"),
                .product(name: "ZoidbergBotProtocol", package: "ZoidbergBotKit"),
            ],
            path: "Sources/ZoidbergBotMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "ZoidbergBotIPCTests",
            dependencies: [
                "ZoidbergBotIPC",
                "ZoidbergBot",
                "ZoidbergBotDiscovery",
                .product(name: "ZoidbergBotProtocol", package: "ZoidbergBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
