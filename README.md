# Astro Project: Code for Toyama Open Data

## 開発
Node.js 22.19以降が必要です（CIはNode.js 22を使用）。

```bash
npm ci
npm run dev
```

## ビルド
```bash
npm run build
```

## セキュリティの確認

```bash
npm run check
npm test
npm audit --audit-level=moderate
```

本番ビルド後には、CSPのハッシュと配信ヘッダーも検証します。

```bash
npm run build
npm run test:build-security
```

Astro標準のCSPが各ページのスクリプト・CSSのハッシュを生成します。
未許可のスクリプト、インラインイベント属性、外部フレーム、プラグイン、フォーム送信を制限します。
解析への同意後に必要なGoogleのスクリプトと通信先だけを許可しています。
全ページに`Referrer Policy: no-referrer`のHTML設定を追加しています。

## CloudflareでHTTPヘッダーを配信する

GitHub PagesではHTMLのCSPとReferrer Policyが有効です。
生成される`_headers`はGitHub PagesではHTTPヘッダーとして解釈されません。
Cloudflare Workersの静的アセット配信では、このファイルからCSP、`X-Frame-Options: DENY`、
`nosniff`、HSTS、Referrer／Permissions Policy、CORPを設定します。
CSPの`frame-ancestors 'none'`はHTTPヘッダーにだけ追加します。

Cloudflare用ビルドはルートURLで配信し、GitHub Pages用の`dist`とは別の`dist-cloudflare`に保存します。

```bash
npm run build:cloudflare -- https://code-for-toyama-opendata.tominari.workers.dev
```

`CSP_BUILD_DIR=dist-cloudflare`を設定して`npm run test:build-security`を実行できます。
ローカル配信は`npm run dev:cloudflare`、認証確認は`npx wrangler whoami`です。
確認済みのビルドを公開するには、対象アカウントとURLを確認した上で`npm run deploy:cloudflare`を実行します。
Cloudflare公開はCLIによる手動操作で、GitHubへのpushだけでは更新されません。
認証トークンをソースや設定ファイルに記録しないでください。

PRと毎週の定期実行で型検査・セキュリティ回帰テスト・依存監査・ビルドを行います。
公開はmasterへのpush、またはmasterからの手動実行に限定しています。
Dependabotがnpm依存とGitHub Actionsの更新PRを週次で作成します。
外部リンクはビルド時と描画時にHTTPSを検証し、カード内容はDOMのテキストとして描画します。
Analyticsは同意後にのみ読み込み、広告用の同意は付与しません。

GitHubとGoogle Analyticsの管理者は、次の運用設定を別途確認してください。

- GitHubの管理者・共同作業者・トークン・連携アプリと、GA4の管理者権限を棚卸しする。
- 管理者のMFA、masterのレビュー必須設定、github-pages環境の公開ブランチ制限を確認する。
- ログイン・アカウント変更・公開履歴を直近1か月から3か月に広げて点検し、ログの保持期間と担当者を決める。
- GA4のデータ保持期間、拡張計測、URLや検索情報の収集設定を点検し、必要最小限にする。
- 不審なアカウントやログを見つけた場合は証跡を保全し、インシデント対応を開始する。

これらのサービス側の設定と履歴は、ソースコードの変更だけでは確認・変更できません。

## デプロイ
GitHub Actions で自動デプロイされます。手動でビルド&デプロイ:
```bash
npm run build
```
