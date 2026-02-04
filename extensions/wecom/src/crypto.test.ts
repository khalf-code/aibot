import { describe, expect, it } from "vitest";
import {
  computeWecomMsgSignature,
  decryptWecomEncrypted,
  encryptWecomPlaintext,
  verifyWecomSignature,
} from "./crypto.js";

const encodingAESKey = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const receiveId = "corp123";

function encryptMessage(plaintext: string): string {
  return encryptWecomPlaintext({
    encodingAESKey,
    receiveId,
    plaintext,
  });
}

describe("wecom crypto", () => {
  it("roundtrips encrypt/decrypt", () => {
    const payload = JSON.stringify({ msgtype: "text", text: { content: "hello" } });
    const encrypted = encryptMessage(payload);
    const decrypted = decryptWecomEncrypted({
      encodingAESKey,
      receiveId,
      encrypt: encrypted,
    });
    expect(decrypted).toBe(payload);
  });

  it("verifies signature", () => {
    const encrypt = encryptMessage("test");
    const signature = computeWecomMsgSignature({
      token: "token123",
      timestamp: "1700000000",
      nonce: "nonce",
      encrypt,
    });

    expect(
      verifyWecomSignature({
        token: "token123",
        timestamp: "1700000000",
        nonce: "nonce",
        encrypt,
        signature,
      }),
    ).toBe(true);
  });
});
