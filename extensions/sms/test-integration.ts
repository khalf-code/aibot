/**
 * SMS Extension Integration Test
 * Run with: npx tsx test-integration.ts
 */

import { smsPlugin } from "./src/channel.js";
import { PlivoProvider } from "./src/providers/index.js";
import { startWebhookServer } from "./src/webhook.js";
import type { SMSResolvedAccount } from "./src/types.js";

// Test configuration
// Set these environment variables before running:
// PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, SMS_PHONE_NUMBER, TEST_PHONE_NUMBER
const TEST_CONFIG = {
  channels: {
    sms: {
      provider: "plivo",
      phoneNumber: process.env.SMS_PHONE_NUMBER || "+15550001234",
      plivo: {
        authId: process.env.PLIVO_AUTH_ID,
        authToken: process.env.PLIVO_AUTH_TOKEN,
      },
      webhookPath: "/sms",
      enableQuickCommands: true,
    },
  },
};

async function testConfigAdapter() {
  console.log("\n=== Testing Config Adapter ===");

  const accountIds = smsPlugin.config.listAccountIds(TEST_CONFIG);
  console.log("Account IDs:", accountIds);

  const account = smsPlugin.config.resolveAccount(TEST_CONFIG, "default");
  console.log("Resolved account:", {
    provider: account?.provider,
    phoneNumber: account?.phoneNumber,
    dmPolicy: account?.dmPolicy,
    enableQuickCommands: account?.enableQuickCommands,
  });

  const isConfigured = smsPlugin.config.isConfigured(TEST_CONFIG, "default");
  console.log("Is configured:", isConfigured);

  const description = smsPlugin.config.describeAccount(TEST_CONFIG, "default");
  console.log("Account description:", description);

  return account;
}

async function testPlivoProvider(account: SMSResolvedAccount) {
  console.log("\n=== Testing Plivo Provider ===");

  const providerConfig = account.providerConfig as { authId: string; authToken: string };
  const provider = new PlivoProvider(providerConfig);

  try {
    await provider.initialize();
    console.log("Provider initialized successfully");
  } catch (error) {
    console.error("Provider initialization failed:", error);
    throw error;
  }

  return provider;
}

async function testOutboundAdapter(_account: SMSResolvedAccount) {
  console.log("\n=== Testing Outbound Adapter ===");

  // Test resolveTarget with fake 555 numbers
  const target1 = smsPlugin.outbound.resolveTarget("+15550001234");
  console.log("Resolve target (+15550001234):", target1);

  const target2 = smsPlugin.outbound.resolveTarget("5550001234");
  console.log("Resolve target (5550001234):", target2);

  const target3 = smsPlugin.outbound.resolveTarget("invalid");
  console.log("Resolve target (invalid):", target3);
}

async function testWebhookServer(provider: PlivoProvider, account: SMSResolvedAccount) {
  console.log("\n=== Testing Webhook Server ===");

  const { server, stop } = await startWebhookServer({
    provider,
    account,
    accountId: "default",
    path: "/sms",
    port: 3456,
    onMessage: async (message) => {
      console.log("Received message:", message);
      return `Echo: ${message.text}`;
    },
    log: (msg, data) => console.log(`[Webhook] ${msg}`, data || ""),
  });

  console.log("Webhook server running on http://localhost:3456/sms");

  return { server, stop };
}

async function testSendSMS(provider: PlivoProvider, fromNumber: string) {
  console.log("\n=== Testing SMS Send ===");

  const testNumber = process.env.TEST_PHONE_NUMBER;
  if (!testNumber) {
    console.log("Skipping send test: TEST_PHONE_NUMBER not set");
    return { ok: false, error: "TEST_PHONE_NUMBER not set" };
  }

  console.log(`Sending test SMS to ${testNumber}...`);

  const result = await provider.sendText({
    from: fromNumber,
    to: testNumber,
    text: "Hello from SMS extension test! Provider: Plivo",
  });

  console.log("Send result:", result);
  return result;
}

async function testCapabilities() {
  console.log("\n=== Testing Capabilities ===");
  console.log("Channel ID:", smsPlugin.id);
  console.log("Meta:", smsPlugin.meta);
  console.log("Capabilities:", smsPlugin.capabilities);
}

async function main() {
  console.log("🚀 Starting SMS extension integration test...\n");

  try {
    // Test config
    const account = await testConfigAdapter();
    if (!account) {
      throw new Error("Failed to resolve account");
    }

    // Test capabilities
    await testCapabilities();

    // Test Plivo provider
    const provider = await testPlivoProvider(account);

    // Test outbound adapter
    await testOutboundAdapter(account);

    // Ask if user wants to test sending
    const args = process.argv.slice(2);
    if (args.includes("--send")) {
      await testSendSMS(provider, account.phoneNumber);
    } else {
      console.log("\n(Skipping SMS send test. Use --send flag to test actual sending)");
    }

    // Test webhook server
    if (args.includes("--webhook")) {
      const { stop } = await testWebhookServer(provider, account);
      console.log("\nWebhook server started. Press Ctrl+C to stop.");
      console.log("Waiting for incoming messages...\n");

      process.on("SIGINT", async () => {
        console.log("\nShutting down...");
        await stop();
        process.exit(0);
      });

      // Keep running
      await new Promise(() => {});
    }

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
