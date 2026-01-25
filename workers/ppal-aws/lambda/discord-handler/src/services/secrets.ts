import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});

export interface DiscordSecrets {
  token: string;
  public_key: string;
}

export interface GitHubSecret {
  token: string;
}

export interface OpenAISecret {
  api_key: string;
}

/**
 * Discord bot tokenを取得
 */
export async function getDiscordToken(): Promise<string> {
  const secretArn = process.env.DISCORD_BOT_TOKEN_SECRET_ARN;
  if (!secretArn) throw new Error("DISCORD_BOT_TOKEN_SECRET_ARN not set");

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  const secret = JSON.parse(response.SecretString || "{}");
  return secret.token as string;
}

/**
 * Discord public keyを取得
 */
export async function getDiscordPublicKey(): Promise<string> {
  const secretArn = process.env.DISCORD_PUBLIC_KEY_SECRET_ARN;
  if (!secretArn) throw new Error("DISCORD_PUBLIC_KEY_SECRET_ARN not set");

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  const secret = JSON.parse(response.SecretString || "{}");
  return secret.public_key as string;
}

/**
 * GitHub tokenを取得
 */
export async function getGitHubToken(): Promise<string> {
  const secretArn = process.env.GITHUB_TOKEN_SECRET_ARN;
  if (!secretArn) throw new Error("GITHUB_TOKEN_SECRET_ARN not set");

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  const secret = JSON.parse(response.SecretString || "{}");
  return secret.token as string;
}

/**
 * OpenAI API keyを取得
 */
export async function getOpenAIApiKey(): Promise<string> {
  const secretArn = process.env.OPENAI_API_KEY_SECRET_ARN;
  if (!secretArn) throw new Error("OPENAI_API_KEY_SECRET_ARN not set");

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  const secret = JSON.parse(response.SecretString || "{}");
  return secret.api_key as string;
}

/**
 * すべてのDiscordシークレットを取得
 */
export async function getDiscordSecrets(): Promise<DiscordSecrets> {
  const [token, public_key] = await Promise.all([
    getDiscordToken(),
    getDiscordPublicKey(),
  ]);
  return { token, public_key };
}
