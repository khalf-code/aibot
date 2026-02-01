// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "ZoidbergBotKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "ZoidbergBotProtocol", targets: ["ZoidbergBotProtocol"]),
        .library(name: "ZoidbergBotKit", targets: ["ZoidbergBotKit"]),
        .library(name: "ZoidbergBotChatUI", targets: ["ZoidbergBotChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "ZoidbergBotProtocol",
            path: "Sources/ZoidbergBotProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ZoidbergBotKit",
            dependencies: [
                "ZoidbergBotProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/ZoidbergBotKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ZoidbergBotChatUI",
            dependencies: [
                "ZoidbergBotKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/ZoidbergBotChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "ZoidbergBotKitTests",
            dependencies: ["ZoidbergBotKit", "ZoidbergBotChatUI"],
            path: "Tests/ZoidbergBotKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
