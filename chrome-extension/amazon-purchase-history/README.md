# Amazon Purchase History Extractor Chrome Extension

Amazon（.com, .co.jpなど）のユーザーの購入履歴を抽出するChrome Extensionです。

## 機能

- Amazon注文履歴ページから購入情報を自動抽出
- 複数のAmazonドメインに対応（.com, .co.jp, .de, .fr, .it, .es, .co.uk）
- 抽出データの表示・管理
- JSONファイルとしてのデータエクスポート
- 重複データの自動除去
- リアルタイムでの抽出状況表示

## インストール方法

1. Chromeを開く
2. `chrome://extensions/` にアクセス
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. このディレクトリ（`chrome-extension-amazon-purchase-history`）を選択

## 使用方法

1. **Amazon注文履歴ページに移動**
   - Amazon.com: https://www.amazon.com/gp/your-account/order-history
   - Amazon.co.jp: https://www.amazon.co.jp/gp/your-account/order-history

2. **拡張機能を起動**
   - ブラウザのツールバーにある拡張機能アイコンをクリック

3. **購入履歴を抽出**
   - 「購入履歴を抽出」ボタンをクリック
   - 複数ページがある場合は、各ページで実行

4. **データの確認・エクスポート**
   - 「抽出データを表示」で内容確認
   - 「JSONでエクスポート」でファイル保存

## 抽出される情報

- 注文ID
- 注文日
- 商品名
- 商品URL
- 商品画像URL
- 価格情報
- 配送状況
- 抽出日時

## ファイル構成

```
chrome-extension-amazon-purchase-history/
├── manifest.json      # 拡張機能の設定ファイル
├── popup.html         # ポップアップUIのHTML
├── popup.css          # ポップアップのスタイル
├── popup.js           # ポップアップの動作制御
├── content.js         # Amazonページでの抽出処理
├── background.js      # バックグラウンド処理
└── README.md          # このファイル
```

## 対応サイト

- Amazon.com (アメリカ)
- Amazon.co.jp (日本)
- Amazon.de (ドイツ)
- Amazon.fr (フランス)
- Amazon.it (イタリア)
- Amazon.es (スペイン)
- Amazon.co.uk (イギリス)

## 注意事項

- この拡張機能は個人の購入履歴データを扱います
- データは Browser のローカルストレージに保存されます
- Amazonの利用規約に従って使用してください
- ページの構造変更により動作しない場合があります

## トラブルシューティング

### 抽出できない場合
1. Amazon注文履歴ページにいることを確認
2. ページが完全に読み込まれるまで待機
3. 拡張機能を再読み込み

### データが表示されない場合
1. 「抽出データを表示」ボタンをクリック
2. ストレージをクリアして再実行

## プライバシー

- 抽出したデータはユーザーのブラウザ内にのみ保存されます
- 外部サーバーへのデータ送信は行いません
- データの削除は「データをクリア」ボタンで可能です

## 開発者情報

このChrome Extensionは学習・研究目的で作成されています。商用利用の際はAmazonの利用規約をご確認ください。