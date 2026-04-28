# 制作PM (MVP-5 JSONバックアップ対応)

Googleカレンダーを正本として読み取り、制作タスクをローカルPMビューとして表示するアプリです。

## 方針
- Firebase / Firestore 不使用
- 独自サーバー不使用
- 有料DB・有料API前提なし
- Googleカレンダー書き戻しは未実装
- TaskとTaskOverlayは分離
- 遅延はstatusに保存しない（表示フラグ）

## 起動
```bash
npm install
npm run dev
```

## ワークスペースコード
- `tokigire`

## MVP-3後半で追加
- 5列タスクボードでHTML5 Drag & Drop対応
- 列間D&DでTaskOverlay.status更新
- 同列内並び替え
- TaskOverlay.sortOrder保存
- ボタン式状態変更UIを引き続き併用

## MVP-5で追加（JSONバックアップ）
- JSONバックアップ書き出し（ダウンロード）
- JSONバックアップ読み込みとバリデーション
- TaskOverlay上書き復元（status / sortOrder を含む）
- 表示設定（viewPreference）のバックアップ・復元
- 最終バックアップ日時の表示

## タスクボードUI調整（MVP-5後）
- 5列ボードの余白・カード密度・列ヘッダーを整理
- 状態ピルと警告表示（遅延/解析エラー/未分類）を視認しやすく調整
- D&D の drop-active / dragging の視覚効果を維持したまま見た目を調整
- 機能仕様（status変更、sortOrder保存、JSONバックアップ導線）は変更なし
- Googleカレンダー書き戻しは未実装のまま

## ワークスペースホームUI調整（MVP-5後）
- ワークスペースホームのヘッダー余白と導線（タスクボード / 設定・バックアップ）を整理
- プロジェクトカードを主役にし、プロジェクト名・現在工程・マイルストーン・件数表示の視認性を調整
- 全体サマリー（全タスク/今日/遅延/確認待ち/修正待ち/解析エラー/未分類）を見やすく整理
- 今日の予定をホーム内で見やすく表示（独立タブ化は未実装）
- 機能仕様は変更せず、Googleカレンダー書き戻しは未実装のまま

## プロジェクト概要UI調整（MVP-5後）
- 上部情報（ワークスペース名 / プロジェクト名 / 種別 / 現在工程 / マイルストーン / 導線）を整理
- 現在工程、マイルストーン、今日やること、遅延・注意、確認・修正、状況サマリー、今週予定をカードで整理
- 状態ピルと遅延警告の視認性を調整
- 機能仕様は変更せず、Googleカレンダー書き戻しは未実装のまま

## 今日画面（MVP追加）
- プロジェクト概要から遷移できる「今日画面」を追加
- 今日の予定タイムライン、今日締切、今日中に確認するもの、状態サマリーを表示
- すべて TaskViewModel 由来で算出
- 状態変更は既存の TaskOverlay.status 更新処理を利用
- Googleカレンダー書き戻しは未実装、通知・時間記録も未実装

## 工程画面（MVP追加）
- プロジェクト概要から遷移できる「工程画面」を追加
- WorkflowTemplate / WorkflowStage を使って工程一覧を表示
- 選択中工程の目的、完了条件、関連タスク、進捗率を表示
- TaskViewModel由来で関連タスク件数・進捗・遅延を算出
- 工程編集・依存関係管理は未実装、Googleカレンダー書き戻しは未実装

## 確認・修正画面（MVP追加）
- プロジェクト概要から遷移できる「確認・修正画面」を追加
- 確認待ち/修正待ちタスクを集約表示し、遅延・今日対応・担当者別・工程別を見やすく表示
- 状態変更ボタンは既存の TaskOverlay.status 更新処理を利用（Task本体は変更しない）
- Googleカレンダー書き戻しは未実装のまま
- 通知機能、レビューコメントスレッド、差分レビューは未実装

### エクスポート対象
- workspace
- projects
- workflowTemplates
- taskOverlays
- viewPreference
- lastSyncedAt
- appVersion / exportedAt / backupSchemaVersion

### インポート対象
- taskOverlays（必須）
- viewPreference
- workspace / projects / workflowTemplates は参照情報として保持（Googleカレンダー予定そのものは対象外）

### バリデーション
- app が `seisaku-pm` であること
- backupSchemaVersion / exportedAt が存在すること
- taskOverlays が配列であること
- taskOverlay ごとに `taskId` / `googleCalendarEventId` / 正しい `status` を持つこと
- `sortOrder` がある場合は number であること
- 不正JSONは読み込まず、既存localStorageを変更しないこと

## 未実装
- Googleカレンダー書き戻し
- Googleカレンダー予定そのものの復元
- 自動バックアップ
- Google Drive自動保存
- ポーリング同期
- Driveファイル作成
- Google Picker / drive.file scope最適化
- 高度な検索
- 高度なフィルター
