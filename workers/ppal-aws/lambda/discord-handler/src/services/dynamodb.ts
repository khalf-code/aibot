import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE_NAME || "";
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE_NAME || "";

export interface User {
  user_id: string;
  guild_id?: string;
  username?: string;
  state?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  conversation_id: string;
  user_id: string;
  guild_id?: string;
  messages: number;
  last_activity: string;
  created_at: string;
}

/**
 * ユーザーを取得
 */
export async function getUser(userId: string): Promise<User | null> {
  const response = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
    })
  );

  return (response.Item as User) || null;
}

/**
 * ユーザーを作成または更新
 */
export async function putUser(user: User): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    })
  );
}

/**
 * ユーザー状態を更新
 */
export async function updateUserState(
  userId: string,
  state: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: "SET #state = :state, #updated = :updated",
      ExpressionAttributeNames: {
        "#state": "state",
        "#updated": "updated_at",
      },
      ExpressionAttributeValues: {
        ":state": state,
        ":updated": new Date().toISOString(),
      },
    })
  );
}

/**
 * ギルド内のユーザーを一覧取得
 */
export async function listUsersByGuild(guildId: string): Promise<User[]> {
  const response = await docClient.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "GuildIndex",
      KeyConditionExpression: "guild_id = :guild_id",
      ExpressionAttributeValues: {
        ":guild_id": guildId,
      },
    })
  );

  return (response.Items as User[]) || [];
}

/**
 * 会話を作成または更新
 */
export async function putConversation(
  conversation: Conversation
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: conversation,
    })
  );
}

/**
 * ユーザーの会話を一覧取得
 */
export async function listConversationsByUser(
  userId: string
): Promise<Conversation[]> {
  const response = await docClient.send(
    new QueryCommand({
      TableName: CONVERSATIONS_TABLE,
      IndexName: "UserIndex",
      KeyConditionExpression: "user_id = :user_id",
      ExpressionAttributeValues: {
        ":user_id": userId,
      },
    })
  );

  return (response.Items as Conversation[]) || [];
}
