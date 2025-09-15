# SSL証明書設定ガイド

## 方法1: Google Managed Certificate (推奨)

### 1. Pulumiで管理される証明書を作成
`index.ts`に以下を追加：

```typescript
// SSL Certificate (Google Managed)
const sslCertificate = new gcp.compute.ManagedSslCertificate("vsr-ssl-cert", {
    managed: {
        domains: [
            frontendDomain,  // vsr-demo.tidequest.net
            backendDomain,   // vsr-api.tidequest.net
        ],
    },
});

// HTTPS proxy - SSL証明書を参照
const httpsProxy = new gcp.compute.TargetHttpsProxy("vsr-https-proxy", {
    urlMap: urlMap.selfLink,
    sslCertificates: [sslCertificate.selfLink],  // ← ここで参照
});

// HTTPS forwarding rule
const httpsForwardingRule = new gcp.compute.GlobalForwardingRule("vsr-https-forwarding-rule", {
    ipAddress: lbStaticIp.address,
    ipProtocol: "TCP",
    portRange: "443",
    target: httpsProxy.selfLink,
});
```

## 方法2: 既存の証明書を参照

### 1. 既に作成済みの証明書がある場合
```typescript
// 既存の証明書を参照
const existingCert = gcp.compute.getSslCertificate({
    name: "vsr-ssl-cert",  // 既存の証明書名
});

// HTTPS proxy
const httpsProxy = new gcp.compute.TargetHttpsProxy("vsr-https-proxy", {
    urlMap: urlMap.selfLink,
    sslCertificates: [existingCert.then(cert => cert.selfLink)],
});
```

## 方法3: Self-managed証明書（Let's Encrypt等）

### 1. 証明書ファイルがある場合
```typescript
const sslCertificate = new gcp.compute.SslCertificate("vsr-ssl-cert", {
    certificate: fs.readFileSync("./certs/fullchain.pem", "utf8"),
    privateKey: fs.readFileSync("./certs/privkey.pem", "utf8"),
});

const httpsProxy = new gcp.compute.TargetHttpsProxy("vsr-https-proxy", {
    urlMap: urlMap.selfLink,
    sslCertificates: [sslCertificate.selfLink],
});
```

## 重要な注意事項

### Google Managed Certificate使用時
- **DNSが先に設定されている必要があります**
- 証明書のプロビジョニングに最大60分かかります
- DNSがロードバランサーIPを指していないと証明書が発行されません

### 推奨手順
1. まずHTTPでデプロイ（現在の状態）
2. DNSを設定
3. DNSが反映されたことを確認
4. SSL証明書のコードを追加して`pulumi up`
5. 証明書のプロビジョニングを待つ（ステータス確認）

### 証明書ステータスの確認
```bash
# 証明書の状態を確認
gcloud compute ssl-certificates describe vsr-ssl-cert --global

# ACTIVE になるまで待つ
watch gcloud compute ssl-certificates describe vsr-ssl-cert --global --format="get(managed.status)"
```

## 完全なHTTPS対応コード例

```typescript
// SSL Certificate
const sslCertificate = new gcp.compute.ManagedSslCertificate("vsr-ssl-cert", {
    managed: {
        domains: [frontendDomain, backendDomain],
    },
});

// HTTPS proxy
const httpsProxy = new gcp.compute.TargetHttpsProxy("vsr-https-proxy", {
    urlMap: urlMap.selfLink,
    sslCertificates: [sslCertificate.selfLink],
});

// HTTPS forwarding rule
const httpsForwardingRule = new gcp.compute.GlobalForwardingRule("vsr-https-forwarding-rule", {
    ipAddress: lbStaticIp.address,
    ipProtocol: "TCP",
    portRange: "443",
    target: httpsProxy.selfLink,
});

// HTTPからHTTPSへのリダイレクト（オプション）
const redirectUrlMap = new gcp.compute.URLMap("redirect-url-map", {
    defaultUrlRedirect: {
        httpsRedirect: true,
        stripQuery: false,
    },
});

const redirectHttpProxy = new gcp.compute.TargetHttpProxy("redirect-http-proxy", {
    urlMap: redirectUrlMap.selfLink,
});

// HTTP forwarding rule (リダイレクト用)
const httpForwardingRule = new gcp.compute.GlobalForwardingRule("vsr-http-forwarding-rule", {
    ipAddress: lbStaticIp.address,
    ipProtocol: "TCP",
    portRange: "80",
    target: redirectHttpProxy.selfLink,
});
```