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
