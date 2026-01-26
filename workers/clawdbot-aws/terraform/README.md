# Clawdbot AWS Deployment

ECS Fargateを使用したClawdbotのAWSデプロイメント設定

## 前提条件

- AWS CLI設定済み
- Terraformインストール済み
- Dockerインストール済み

## セットアップ手順

### 1. Discord Bot TokenをSecrets Managerに保存

```bash
# Secrets Managerにシークレットを作成
aws secretsmanager create-secret \
  --name clawdbot/discord-token \
  --description "Discord Bot Token for Clawdbot" \
  --secret-string "your_discord_bot_token_here"

# シークレットを確認
aws secretsmanager get-secret-value --secret-id clawdbot/discord-token
```

### 2. Terraform変数の設定

`.env.example`をコピーして`terraform.tfvars`を作成:

```bash
cp .env.example terraform.tfvars
```

`terraform.tfvars`を編集して以下の値を設定:
- `aws_account_id`: AWSアカウントID
- `discord_token_secret_name`: Secrets Managerのシークレット名（デフォルト: `clawdbot/discord-token`）

### 3. Terraformの実行

```bash
# Terraform初期化
terraform init

# 設定確認
terraform plan

# デプロイ実行
terraform apply
```

### 4. Dockerイメージのプッシュ

```bash
# ECRログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージビルド
docker build -t clawdbot .

# タグ付け
docker tag clawdbot:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/clawdbot:latest

# プッシュ
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/clawdbot:latest
```

### 5. ECSサービスの更新

```bash
# 新しいタスク定義でECSサービスを更新
aws ecs update-service \
  --cluster clawdbot-cluster \
  --service clawdbot-service \
  --force-new-deployment
```

## セキュリティベストプラクティス

- ✅ Discord Bot TokenはAWS Secrets Managerに保存
- ✅ IAMロールで最小権限の原則を適用
- ✅ S3バケットでAES256暗号化を有効化
- ✅ DynamoDBでPITR（Point-in-Time Recovery）を有効化
- ✅ VPC内にプライベートサブネットを配置

## コスト最適化

- ECS Fargate: 256 CPU, 2048 MBメモリ（最小構成）
- CloudWatch Logs: 7日間保持
- S3ライフサイクル: 7日間で古いアーティファクトを自動削除

## 監視とログ

### CloudWatch Logs

```bash
# ログストリーム確認
aws logs tail /ecs/clawdbot --follow
```

### ECSタスクの状態確認

```bash
# サービス状態
aws ecs describe-services --cluster clawdbot-cluster --services clawdbot-service

# タスク一覧
aws ecs list-tasks --cluster clawdbot-cluster
```

## トラブルシューティング

### コンテナが起動しない場合

1. CloudWatch Logsでエラーを確認
2. タスク定義の環境変数を確認
3. Secrets Managerからシークレットが取得できているか確認

### Discord Botが応答しない場合

1. ECSタスクが実行中か確認
2. セキュリティグループでアウトバウンド通信が許可されているか確認
3. Discord Bot Tokenが正しいか確認

## クリーンアップ

```bash
terraform destroy
```

注意: Secrets Managerのシークレットは手動で削除する必要があります:

```bash
aws secretsmanager delete-secret --secret-id clawdbot/discord-token
```
