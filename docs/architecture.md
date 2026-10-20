# 構成と収録範囲

## 実行時の構成

できた！はビルド工程のない静的サイトです。
`index.html` が `src/main.js` を ES module として読み込み、各ゲームのモジュールと共通部品を組み立てます。
サーバー側の処理、外部API、外部フォント、第三者のJavaScriptは使いません。

| 層 | ファイル | 役割 |
| --- | --- | --- |
| 入口 | `index.html`、`style.css`、`src/main.js` | 全画面のマークアップ、デザイントークン、ゲームの登録 |
| 共通部品 | `src/modules/core/` | 画面切替、ゲームの状態とハイスコア、進捗表示、音声再生、ゲームの基底クラス |
| ゲーム | `src/modules/games/` | 9種類の遊び。各クラスが出題、回答の判定、完了を担当する |
| 出題データ | `src/modules/data/` | 文字、しりとりの単語、音声の対応表 |
| 生成処理 | `src/modules/utils/` | 迷路の経路生成、ブロックの敷き詰め生成、絵の配置、乱数 |
| 音声 | `audio/*.mp3` | VOICEVOX:ずんだもん で事前生成した問題文、声かけ、動物の鳴き声 |
| 引き継ぎ | `migration.html`、`migration.js` | 旧配信先から新配信先へハイスコアをファイルで移す保護者向けページ |

保存するのは端末の localStorage にあるハイスコアだけです。
アカウント、通信による記録の送信、解析用のタグはありません。

## 配信

公開版は Cloudflare Workers Static Assets で配信しています。
`scripts/build-cloudflare.py` が、公開する資産(HTML、CSS、favicon、`_headers`、音声、`src` のJavaScript)だけを `dist/` に複製します。
テスト、文書、スクリプト、`node_modules` は配信物に入りません。
配備は `python3 scripts/build-cloudflare.py` の後に Wrangler で `dist/` を上げます。
Wrangler はこのリポジトリの依存に含めていません。
利用プランと規約の確認は [tool-license-cloudflare.yaml](tool-license-cloudflare.yaml) に記録しています。
この記録の adoption 欄にある「ikimono-note」は、元の記録の誤記をそのまま収録したものです。

`scripts/check-cloudflare.mjs` は、`wrangler dev` または配備先のURLに対して画面の遷移とハイスコアの引き継ぎを確認します。

## 音声の生成

`generate-voicevox-audio.cjs` は、ローカルで起動した VOICEVOX エンジンに speaker 3(ずんだもん)で合成を依頼し、`audio/` に MP3 を書き出します。
音声は収録済みのため、遊ぶだけなら VOICEVOX は不要です。
しりとりの単語と音声ファイル名は `src/modules/data/ShiritoriWords.js` で定義し、生成処理とブラウザ再生の両方が参照します。

## 収録しなかったファイル

収録元は運用リポジトリのコミット済みファイルです。履歴と未コミットのファイルは含めていません。
収録しなかったファイルと理由、公開のために変えたファイルは [source-manifest.json](source-manifest.json) に記録しています。

| 対象 | 理由 |
| --- | --- |
| Cloud Run 用の Dockerfile、nginx 設定、Cloud Build 設定 | 退役した配備経路のため |
| 運用ログ、Cloudflare 配備メモ | 内部の課題番号や版の識別子を含むため。配備手順は本書にまとめた |
| `tests/e2e/esm-*.spec.js`、`network-events.spec.js` | 特定ポートに固定した調査用のプローブで、環境に依存して失敗するため。モジュールの読み込みは、全画面を開く layout.spec.js がページエラーなしを確認する |

公開のために変えたファイルは3つです。
`index.html` と `migration.html` からは、自宅LAN内でしか動かないアクセス記録のタグを外しました。
`generate-voicevox-audio.cjs` は、運用環境の絶対パスだった出力先をスクリプトからの相対パスにしました。
