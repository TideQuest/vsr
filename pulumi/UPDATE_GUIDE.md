# Pulumi 再適用ガイド

## 既存リソースの更新手順

すでに`pulumi up`を実行済みの場合、以下の手順で変更を再適用できます：

### 1. 最新の変更を取得
```bash
git pull origin vk/4b8a-pulumi-gcp
```

### 2. 変更内容をプレビュー
```bash
cd pulumi
pulumi preview
```

### 3. 変更を適用
```bash
pulumi up
```

実行すると以下のような差分が表示されます：
- `~` は更新されるリソース
- `+` は新規作成されるリソース
- `-` は削除されるリソース

### 4. 確認して実行
変更内容を確認後、`yes`を入力して適用します。

## トラブルシューティング

### HTTPSプロキシエラーが発生した場合
SSL証明書が未設定の場合、HTTPSプロキシの作成でエラーになります。
現在のコードではHTTPSプロキシをコメントアウトしているため、HTTPのみで動作します。

### HTTPS を有効にする場合
1. SSL証明書を作成：
```bash
gcloud compute ssl-certificates create vsr-ssl-cert \
  --domains=vsr-demo.tidequest.net,vsr-api.tidequest.net \
  --global
```

2. `index.ts`のHTTPSプロキシのコメントを解除して証明書を参照

3. 再度`pulumi up`を実行

### リソースの強制更新
特定のリソースを強制的に再作成する場合：
```bash
pulumi up --replace urn:pulumi:production::vsr-gcp::gcp:compute/instance:Instance::vsr-instance
```

### スタックの状態を確認
```bash
pulumi stack
pulumi stack output
```

## 注意事項
- VMインスタンスを更新すると再起動されます
- ロードバランサーの設定変更は数分かかる場合があります
- DNS設定は変更後も引き続き有効です