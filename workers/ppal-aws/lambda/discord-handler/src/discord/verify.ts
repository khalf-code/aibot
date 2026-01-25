import { getDiscordPublicKey } from "../services/secrets.js";

/**
 * Discord Interactions APIの署名を検証
 */
export async function verifySignature(
  body: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  const publicKey = await getDiscordPublicKey();
  const nacl = await import("tweetnacl");

  const message = timestamp + body;
  const signatureBytes = Buffer.from(signature, "hex");
  const publicKeyBytes = Buffer.from(publicKey, "hex");

  return nacl.sign.detached.verify(
    Buffer.from(message),
    signatureBytes,
    publicKeyBytes
  );
}

/**
 * リクエストヘッダーから署名関連の値を抽出
 */
export function extractSignatureHeaders(headers: {
  [key: string]: string | undefined;
}): { signature: string; timestamp: string } | null {
  const signature = headers["x-signature-ed25519"];
  const timestamp = headers["x-signature-timestamp"];

  if (!signature || !timestamp) {
    return null;
  }

  return { signature, timestamp };
}
