# SSL接続エラー（SSL_ERROR_SYSCALL）トラブルシューティングガイド

## 概要

`vsr-demo.tidequest.net` および `vsr-api.tidequest.net` への HTTPS 接続で `SSL_ERROR_SYSCALL` エラーが発生している問題の調査項目です。

**エラー詳細:**
```
curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to vsr-demo.tidequest.net:443
```

**接続情報:**
- ドメイン: vsr-demo.tidequest.net, vsr-api.tidequest.net
- IP: 34.144.208.206
- SSL証明書: ACTIVE状態

---

## 🔍 確認項目（優先順位順）

### 1. 【最重要】Pulumiリソースの状態確認

```bash
# Pulumiスタックの状態確認
pulumi stack output

# リソースの詳細確認
pulumi stack --show-urns
```

**期待される結果:**
- すべてのリソースが正常にデプロイされている
- 出力値が正しく設定されている

---

### 2. 【重要】VMインスタンスとアプリケーションの確認

```bash
# VMインスタンスの状態
gcloud compute instances list --filter="name~vsr"
gcloud compute instances describe vsr-instance --zone=asia-northeast1-a
```

```bash
# VMにSSHして内部状態確認
gcloud compute ssh vsr-instance --zone=asia-northeast1-a --command="
  # Docker コンテナの状態
  sudo docker-compose -f /opt/vsr/docker-compose.yml ps
  
  # アプリケーションのログ
  sudo docker-compose -f /opt/vsr/docker-compose.yml logs --tail=50
  
  # ポートの待受状態
  sudo netstat -tlnp | grep -E ':(3000|5173)'
  
  # スタートアップスクリプトのログ
  sudo tail -50 /var/log/startup-script.log
"
```

**期待される結果:**
- VMインスタンスが `RUNNING` 状態
- Docker コンテナがすべて `Up` 状態
- ポート 3000（バックエンド）と 5173（フロントエンド）が待受中

---

### 3. 【重要】ヘルスチェックの状態確認

```bash
# ヘルスチェックの一覧
gcloud compute health-checks list --filter="name~vsr"

# 個別ヘルスチェックの詳細
gcloud compute health-checks describe frontend-health-check
gcloud compute health-checks describe backend-health-check
```

**期待される結果:**
- ヘルスチェックが `HEALTHY` 状態
- チェック間隔とタイムアウトが適切

---

### 4. 【重要】バックエンドサービスの確認

```bash
# VSR関連のバックエンドサービス確認
gcloud compute backend-services list --global --filter="name~vsr"

# バックエンドサービスの詳細（ヘルスチェック状態含む）
gcloud compute backend-services describe frontend-backend-service --global
gcloud compute backend-services describe api-backend-service --global
```

**期待される結果:**
- バックエンドサービスが存在する
- インスタンスグループが正しく登録されている
- バックエンドの状態が `HEALTHY`

---

### 5. ロードバランサー設定の確認

```bash
# URL マップの確認
gcloud compute url-maps describe vsr-url-map

# HTTPSプロキシの確認
gcloud compute target-https-proxies describe vsr-https-proxy

# 転送ルールの確認
gcloud compute forwarding-rules list --global --filter="name~vsr"
```

**期待される結果:**
- URL マップでホストルールが正しく設定されている
- HTTPSプロキシにSSL証明書が関連付けられている
- 転送ルールが正しいIPアドレスを使用している

---

### 6. SSL証明書の詳細確認

```bash
# 管理SSL証明書の状態
gcloud compute ssl-certificates list --filter="domains~tidequest.net"

# 具体的な証明書の詳細（証明書名が判明したら）
gcloud compute ssl-certificates describe [証明書名] --global --format="table(name,domains,managed.status,managed.domainStatus)"
```

**期待される結果:**
- 証明書の状態が `ACTIVE`
- 両ドメイン（vsr-demo.tidequest.net, vsr-api.tidequest.net）が `ACTIVE`

---

### 7. ファイアウォールルールの確認

```bash
# VSR関連のファイアウォールルール
gcloud compute firewall-rules list --filter="name~vsr OR name~allow"

# 特定ルールの詳細
gcloud compute firewall-rules describe allow-https
gcloud compute firewall-rules describe allow-health-checks
gcloud compute firewall-rules describe allow-app-ports
```

**期待される結果:**
- HTTPS（443）ポートが開放されている
- ヘルスチェック用のポートが開放されている
- アプリケーションポート（3000, 5173）が開放されている

---

### 8. DNS設定の確認

```bash
# DNSレコードの確認
nslookup vsr-demo.tidequest.net
nslookup vsr-api.tidequest.net

# 実際のIPアドレスとPulumiで設定したIPの照合
gcloud compute addresses list --global --filter="name~vsr"
```

**期待される結果:**
- DNSレコードが正しいIPアドレス（34.144.208.206）を指している
- Pulumiで作成したグローバルIPアドレスと一致している

---

### 9. 手動接続テスト

```bash
# HTTPでの接続テスト（ロードバランサーのIPに直接）
curl -v -H "Host: vsr-demo.tidequest.net" http://34.144.208.206
curl -v -H "Host: vsr-api.tidequest.net" http://34.144.208.206

# VMに直接HTTP接続テスト（VM_EXTERNAL_IPを確認後）
curl -v http://[VM_EXTERNAL_IP]:5173
curl -v http://[VM_EXTERNAL_IP]:3000/health
```

**期待される結果:**
- HTTP接続が成功する
- VMへの直接接続が成功する

---

## 🚨 一般的な原因と対処法

### 1. アプリケーションが起動していない
- **確認:** Docker コンテナの状態
- **対処:** `docker-compose up -d` で再起動

### 2. ヘルスチェックが失敗している
- **確認:** ヘルスチェックのパスとポート
- **対処:** アプリケーションのヘルスエンドポイントを確認

### 3. バックエンドサービスにインスタンスが登録されていない
- **確認:** インスタンスグループの設定
- **対処:** Pulumiの再デプロイ

### 4. SSL証明書の設定ミス
- **確認:** 証明書のドメイン設定
- **対処:** 正しいドメインで証明書を再作成

### 5. ファイアウォールルールの問題
- **確認:** 必要なポートが開放されているか
- **対処:** ファイアウォールルールの追加・修正

---

## 📋 チェックリスト

- [ ] Pulumiスタックの状態確認
- [ ] VMインスタンスの動作確認
- [ ] Dockerコンテナの状態確認
- [ ] アプリケーションポートの待受確認
- [ ] ヘルスチェックの状態確認
- [ ] バックエンドサービスの設定確認
- [ ] SSL証明書の状態確認
- [ ] ファイアウォールルールの確認
- [ ] DNS設定の確認
- [ ] 手動接続テストの実行

---

## 📞 次のステップ

1. **優先度1-4の項目を順番に確認**
2. **問題が見つかった場合は該当する対処法を実行**
3. **すべて正常な場合は、GCPのロードバランサーの内部状態を確認**
4. **必要に応じてPulumiリソースの再デプロイを検討**

---

*作成日: 2025-09-15*
*対象: vsr-demo.tidequest.net, vsr-api.tidequest.net SSL接続エラー*
