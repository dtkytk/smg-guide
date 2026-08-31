# SMG GUIDE サイト(Supabase連携版)

デザイン(桜のヒーロー、EVENTS/GUIDES/VIDEOSカード)はそのまま、Supabaseの `posts` テーブルと連携して記事を自動表示します。

## ファイル構成
- `index.html` … トップページ(NOTICEの最新記事を自動表示)
- `events.html` … EVENTS記事一覧
- `guides.html` … GUIDES記事一覧
- `videos.html` … VIDEOS記事一覧(YouTube埋め込み)
- `notice.html` … NOTICE記事一覧
- `post.html` … 記事詳細ページ(`?id=数字` で表示する記事を切り替え)
- `styles.css` … 共通デザイン
- `app.js` … Supabase接続・多言語切り替えの共通処理
- `config.js` … あなたのSupabaseプロジェクトの接続情報(**今使っているものをそのまま使ってください**。このzipの中身はテンプレートです)

## 今すぐやること

1. このフォルダの `config.js` を、**今お使いの(実際の値が入った)config.js に差し替えて**ください
2. `index.html` をダブルクリックしてブラウザで開き、動作確認してください

## postsテーブルに追加しておくと便利なカラム

今は `id, created_at, title, category, content, published` あたりまでは動作します。以下は今後追加していくと、サイト側の機能がそのまま使えます(サイト側のコード変更は不要です)。

| カラム名 | 型の例 | 用途 |
|---|---|---|
| `title_en` / `content_en` | text | 英語 |
| `title_kr` / `content_kr` | text | 韓国語 |
| `title_tr` / `content_tr` | text | トルコ語 |
| `title_de` / `content_de` | text | ドイツ語 |
| `image_urls` | text[] (配列) | 画像URLを複数登録(記事詳細・一覧のサムネイルに使用) |
| `youtube_urls` | text[] (配列) | YouTube URLを複数登録(VIDEOSページで自動的に埋め込み表示) |
| `updated_at` | timestamptz | 更新日時(現状は未使用ですが将来のため) |

翻訳が未入力の言語は、自動的に日本語(`title` / `content`)が表示されます。

## 動作確認のポイント

- 各カテゴリごとの記事は、`category` 列を `EVENTS` / `GUIDES` / `VIDEOS` / `NOTICE` のいずれかに正しく入れてください(大文字)
- `published` が `true` の記事だけが表示されます。下書き中は `false` にしておいてください
- 表示されない場合は、ブラウザで **F12 → Console タブ** を開いて、`[SMG]` から始まるログを確認してください(どのURLにリクエストしたか、何件取得できたかが出ます)

## デプロイ(公開)する場合

今までと同じ流れです。

1. GitHubで新しいリポジトリを作る
2. このフォルダの中身をpushする
3. Vercelでそのリポジトリを選んでデプロイする(ビルド設定は不要、静的サイトのままでOK)

`config.js` は公開リポジトリに含めても、**Publishable Key(Anon Key)だけなら問題ありません**。Service Role Keyは絶対に含めないでください。
