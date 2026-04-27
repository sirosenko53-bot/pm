# pm

直進優先型ウォーターフォールPMアプリです。

Googleカレンダーから制作予定を取り込み、タスク、進捗、遅延対応、修正リスト、ワークスペース管理を行うためのアプリです。

## 開発運用

- ChatGPTで要件整理・UIレビュー・異常系整理・実装指示文作成を行う
- Codexでコード実装、差分作成、必要に応じたPR作成を行う
- 1回の作業では1テーマだけ扱う
- 実装後はChatGPTで再レビューする
- mainへ直接反映せず、作業ブランチからPRを作る

## 現在の重点課題

- 初回ログイン時のワークスペース導線
- ワークスペース作成中UI
- 二重作成防止
- 初期マスタ軽量化
- Googleカレンダー取込の安全化

## 現在の運用方針（Googleカレンダー正本・ローカルPMビューア）

このアプリは Firestore中心の共同DB型ではなく、Googleカレンダー同期型のローカルPMビューアとして運用します。

- Googleカレンダーを正本データとして扱う
- カレンダー単位を部屋・ワークスペースとして扱う
- ローカルには表示設定・選択中カレンダー・キャッシュのみ保存する
- ログイン時 / リロード時 / 同期時に Google Calendar API から再取得する

### 起動アルゴリズム（MVP）

1. アプリ起動
2. localStorage から設定を読む
3. GSI / GAPI 初期化
4. Googleカレンダー接続確認
5. 接続済みならカレンダー一覧取得
6. 選択カレンダーの events.list
7. eventToTask でローカルタスク化
8. キャッシュ保存
9. `renderAll()`

### 同期方針

- `syncSelectedCalendars()` で selectedCalendarIds を順次 `events.list`
- 結果を統合して `TASKS` に反映
- キャッシュへ保存し、画面を再描画

### オフライン方針

- MVPではオフライン編集は許可しない
- オフライン時はキャッシュ表示のみ

### フェーズ

- Phase 1: Firebase / Firestore依存削除
- Phase 2: Googleカレンダー接続とカレンダー一覧取得
- Phase 3: カレンダー選択とローカル保存
- Phase 4: `events.list` 読み取り同期
- Phase 5: `events.insert/patch` 書き戻し（dirty予定のみ。MVPではdelete未実装）
- Phase 6: progress / project / owner / status メタ情報対応


### バックアップ方針（必須）

- バックアップ・復元は File System Access API（FSA API）を使用する
- PWA配布時は `manifest.json` の設定を必須化する
- バックアップ作成に失敗した場合は同期や削除系処理を中止する

### 次フェーズTODO

- 同期時のローカル編集上書き方針を決める（`dirty` 温存 / マージ / 一時編集扱い）
- 担当者・プロジェクト管理（追加/更新/アーカイブ）を `wsCol` 依存から `LocalStore` 直接更新へ寄せる
- `writeAppState()` に `people` / `projects` を含め、外部JSONバックアップからの復元性を高める
