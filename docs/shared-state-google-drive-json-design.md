# Google Drive共有JSONによる共有状態設計メモ

## 0. 文書の目的と前提

本メモは、制作PMにおける**共有状態の第一候補を Google Drive共有JSON 方式とする**ための設計方針を定義する。  
今回は設計メモのみを対象とし、コード変更・UI実装・API実装は行わない。

前提:
- 予定データの正本は Googleカレンダー。
- PM状態（TaskOverlay）は予定本体と分離して扱う。
- 現在は localStorage + JSONバックアップ運用。
- 無料運用を維持し、独自サーバーを前提にしない。

---

## 1. 現状の課題

1. localStorageのみでは、複数人・複数端末で自動共有できない。  
2. Aさんが更新した「確認待ち」等の状態が、Bさんの画面に自動反映されない。  
3. JSONバックアップは手動復元には有効だが、日常運用の共有正本としては運用負荷が高い。  
4. Googleカレンダー予定自体は共有できる一方、PM状態（status/sortOrder等）が共有されていない。

---

## 2. 共有状態の目的

- チーム全員が同じ status を見る。  
- チーム全員が同じ sortOrder を見る。  
- 「確認待ち / 修正待ち / 完了」等の状態を共通化する。  
- 端末変更時でも PM状態を復元可能にする。  
- Googleカレンダー予定本体を壊さず、PM状態のみを共有する。

---

## 3. 役割分担（正本の境界）

### 3.1 Googleカレンダー
- 予定日時、タイトル、イベントIDの正本。  
- 予定名「担当者 / タスク名 / プロジェクト」の正本。

### 3.2 Google Drive `shared-state.json`（または `workspace-state.json`）
- PM状態の**共有正本**。  
- TaskOverlay の共有先。  
- `status / sortOrder / memo / reviewer / priority / stageOverride` を保存。

### 3.3 localStorage
- 起動後キャッシュ。  
- オフライン時・共有読込失敗時の一時状態。  
- 共有JSON読込後のローカル反映先。

### 3.4 JSONバックアップ
- 復旧用。  
- 上書き前バックアップ。  
- 事故時の巻き戻し用。

---

## 4. Google Drive共有JSONを採用する理由

1. 既存のJSONバックアップ設計（構造・検証・復元フロー）を流用しやすい。  
2. 無料運用を維持しやすい。  
3. 独自サーバー不要で、保守対象を増やしにくい。  
4. Googleカレンダーと同一Googleアカウント運用に乗せやすい。  
5. ファイル単位でバックアップ/復元が明確。  
6. `shared-state.json` の共有設定だけで、共有正本の置き場所を統一できる。

---

## 5. 他方式を第一候補にしない理由

### 5.1 Google Sheets
- 長所: 人間が直接見やすい。  
- 課題: TaskOverlayを表形式へ分解する変換が必要。  
- 課題: JSON構造（ネスト・メタデータ・将来拡張）保持に不向き。  
→ 初期共有正本としては非優先。

### 5.2 Apps Script
- 長所: Drive/Sheets中継APIとして有効。  
- 課題: クォータ、デプロイ、運用管理が増える。  
- 方針: 初期は直接Drive APIで単純化。  
→ 導入は後続候補。

### 5.3 Firestore
- 長所: リアルタイム共有に強い。  
- 課題: Firebase設定、セキュリティルール設計、無料枠・将来課金リスク。  
- 現方針: 「無料で管理されている必要がある」を優先。  
→ 第一候補にしない。

### 5.4 Googleカレンダー説明欄メタデータ
- 長所: カレンダーのみで共有できる。  
- 課題: 予定本体への書き戻しが必要。  
- 課題: 誤更新・競合・復旧運用の難度が高い。  
→ 後続フェーズ検討とする。

---

## 6. 共有JSONに保存するデータ

## 6.1 ルート項目
- `app`
- `sharedStateSchemaVersion`（または `backupSchemaVersion`）
- `workspaceId`
- `workspaceCode`
- `workspaceName`
- `savedAt`（または `exportedAt`）
- `savedBy`
- `taskOverlays`
- `viewPreference`
- `lastSyncedAt`
- `lastSharedStateSavedAt`
- `clientId`（または `deviceId`）
- `revision`

### 6.2 TaskOverlay項目
- `taskId`
- `googleCalendarEventId`
- `status`
- `stageOverride`
- `priority`
- `reviewer`
- `memo`
- `sortOrder`
- `updatedAt`
- `updatedBy`
- `source`

### 6.3 最小サンプル（参考）

```json
{
  "app": "production-pm",
  "sharedStateSchemaVersion": "1.0.0",
  "workspaceId": "ws_001",
  "workspaceCode": "ABC123",
  "workspaceName": "制作PMワークスペース",
  "savedAt": "2026-04-28T00:00:00.000Z",
  "savedBy": "user@example.com",
  "revision": 12,
  "clientId": "device-web-01",
  "lastSyncedAt": "2026-04-28T00:00:00.000Z",
  "lastSharedStateSavedAt": "2026-04-28T00:00:00.000Z",
  "viewPreference": {
    "boardColumns": ["todo", "doing", "review", "done"]
  },
  "taskOverlays": [
    {
      "taskId": "task_001",
      "googleCalendarEventId": "gcal_event_001",
      "status": "review",
      "stageOverride": "確認",
      "priority": "high",
      "reviewer": "Bさん",
      "memo": "初稿レビュー待ち",
      "sortOrder": 1200,
      "updatedAt": "2026-04-28T00:00:00.000Z",
      "updatedBy": "user@example.com",
      "source": "manual"
    }
  ]
}
```

---

## 7. 共有JSONに保存しないデータ

- Googleカレンダー予定そのもの。  
- Googleカレンダーイベント本文全体。  
- OAuthトークン。  
- APIキー。  
- 個人の認証情報。  
- 不要なキャッシュ。  
- UI一時状態。  
- 大きなログ。

---

## 8. 起動時自動読取フロー（初期推奨）

1. ワークスペースコード入力  
2. Workspace設定読み込み  
3. Googleカレンダー予定読み取り  
4. Task生成  
5. Google Drive共有JSON読み取り  
6. `shared-state.json` 検証  
7. TaskOverlayをlocalStorageへ反映  
8. Task + TaskOverlay でTaskViewModel生成  
9. 画面表示

### 8.1 読み取り失敗時
- localStorage状態で起動継続。  
- UIに「共有状態の読み取りに失敗。ローカル状態で表示中」を表示。  
- 既存状態は破壊しない（fail-safe）。

---

## 9. 手動再読取フロー

UI想定ボタン: **「共有状態を再読み込み」**

1. Google Drive `shared-state.json` を取得  
2. バリデーション  
3. 現在localStorageを自動バックアップ  
4. TaskOverlayを共有JSONで上書き  
5. TaskViewModel再生成  
6. 成功メッセージ表示

---

## 10. 手動保存フロー

UI想定ボタン: **「共有状態へ保存」**

1. 現在TaskOverlayを取得  
2. Drive上 `shared-state.json` のrevision確認  
3. 必要時に競合警告  
4. 保存前ローカルバックアップ作成  
5. `shared-state.json` 更新  
6. `savedAt / savedBy / revision` 更新  
7. 成功メッセージ表示

---

## 11. 将来の自動同期方針

### 11.1 将来候補
- 起動時自動読取  
- 画面フォーカス時再読取  
- 60秒ポーリング  
- 手動保存  
- 将来の自動保存

### 11.2 初期実装での推奨範囲
- 起動時自動読取  
- 手動再読取  
- 手動保存

※ 自動保存は後続フェーズで検討し、初期実装には含めない。

---

## 12. 競合時の扱い（MVP）

- `shared-state.json` に `revision` を持つ。  
- 読み込み時の `revision` をローカル保持。  
- 保存時に Drive上revision と ローカル保持revision を比較。  
- 差分があれば「他の人が更新している可能性があります」と警告。  
- 初期実装では「上書き保存 / 再読み込み」をユーザー選択。

MVP基本方針:
- 最終保存勝ち（last write wins）。  
- ただし上書き前に必ずバックアップ。  
- 競合時の自動上書きはしない。

---

## 13. 保存前バックアップ

共有保存前に、現在ローカル状態をJSONバックアップとして退避する。

目的:
- 誤上書き時の復元。  
- 他メンバー変更消失時の復旧。  
- 共有ファイル破損時の巻き戻し。

---

## 14. UIに表示すべき状態

画面上部または設定画面で以下を表示する:

- 状態ソース（ローカル / 共有JSON / 読み取り失敗）
- 共有状態ファイル名
- 最終共有読取日時
- 最終共有保存日時
- 共有状態revision
- 共有後にローカル変更あり
- 共有状態読み取り失敗
- 共有状態保存失敗

---

## 15. 実装フェーズ案

- **Phase S1**: 共有状態設計メモ作成  
- **Phase S2**: 共有状態メタデータ型の追加  
- **Phase S3**: 共有状態ソース表示UI  
- **Phase S4**: DriveファイルID設定欄  
- **Phase S5**: Drive共有JSONの手動読取  
- **Phase S6**: Drive共有JSONの手動保存  
- **Phase S7**: 起動時自動読取  
- **Phase S8**: 競合検知  
- **Phase S9**: ポーリング読取  
- **Phase S10**: 自動保存検討

---

## 16. 今回の非対象（明示）

本フェーズでは以下を実施しない。

- コード変更
- UI実装
- Google Drive API実装
- OAuthスコープ追加
- 依存追加
- 自動同期実装
- Googleカレンダー書き戻し
- Firestore導入
- Sheets導入
- Apps Script導入

---

## 17. 直近の実装開始提案

次工程（実装）に入る場合の最初の着手対象は **Phase S2（共有状態メタデータ型の追加）** を推奨する。  
理由:
1. 既存JSONバックアップ構造との整合を取りやすい。  
2. 後続のUI/読取/保存/競合検知の共通インターフェースを先に固定できる。  
3. 実装影響範囲を限定し、段階的検証が可能。

---

## 18. Phase S2 実装メモ（型とローカル管理の土台）

本ドキュメントに対応するPhase S2では、以下を追加する。

- `src/features/sharedState/sharedStateTypes.ts`  
  - `SharedStateSource`（`local` / `shared-json` / `shared-json-read-failed`）
  - `SharedStatePackage`
  - `SharedStateMetadata`
  - `SharedTaskOverlay`
- `src/features/sharedState/sharedStateStore.ts`  
  - shared-stateメタデータの localStorage 保存/読込
  - 読取成功/失敗、保存成功、ローカル変更フラグ更新のヘルパー

補足:
- このPhaseでは Google Drive API/OAuth/UI同期実装は行わない。
- 既存の `BackupPackage` は復旧用途として維持し、`SharedStatePackage` は共有正本用途として分離する。

---

## 19. Phase S3 実装メモ（共有状態ソース表示UI）

Phase S3では、設定・バックアップ画面に「共有状態」セクションを追加し、以下を表示する。

- 状態ソース（ローカル / 共有JSON / 共有JSON読み取り失敗）
- 同期状態（idle / loading / loaded / saving / saved / failed / conflict）
- 共有JSONファイル名（未設定時は未設定）
- 共有ファイルID（未設定）
- revision
- 最終共有読取日時
- 最終共有保存日時
- savedBy
- deviceId
- 共有後にローカル変更あり
- 最終エラー

あわせて、以下のローカル操作時に `hasLocalChangesAfterShare` を `true` として記録する。

- TaskOverlayのstatus変更
- sortOrder変更
- JSONバックアップ復元

補足:
- Drive API読取/保存は未実装。
- OAuthスコープ追加なし。
- 自動同期・ポーリング・競合解決UIは未実装（後続Phase）。

---

## 20. Phase S4 実装メモ（DriveファイルID設定欄）

Phase S4では、設定・バックアップ画面に「Drive共有JSON設定」カードを追加し、以下を実装する。

- `sharedFileId` 入力
- `sharedFileName`（任意）入力
- 設定保存（localStorage上の `SharedStateMetadata` 更新）
- 設定クリア
- 保存/失敗メッセージ表示

バリデーション方針（最小）:

- 空文字は保存しない
- 前後空白は trim
- URL入力時は可能な範囲で `/d/<id>` または `?id=<id>` からID抽出
- 厳密な存在確認はしない（Drive API未接続）

補足:
- Drive API読取/保存は未実装。
- OAuthスコープ追加なし。
- 自動同期・競合検知・ポーリングは後続Phase。

---

## 21. Phase S5 実装メモ（Drive共有JSONの手動読取）

Phase S5では、保存済み `sharedFileId` を使った手動読取の最小経路を追加する。

- Drive読取クライアントを追加し、`files.get(...?alt=media)` で通常JSONファイルを取得
- 取得前に `mimeType` を確認し、Google Docs / Sheets / Slides は対象外としてエラー化
- `SharedStatePackage` を parse / validate
- 適用前に現在ローカル状態をバックアップスナップショットとして退避
- validな共有JSONのみTaskOverlayとviewPreferenceへ反映
- 読取成功時は `SharedStateMetadata` を更新（source/revision/savedAt/savedBy/deviceId/lastReadAt）
- 読取失敗時は `lastReadError` を記録し、syncStatusを `failed` へ更新

補足:
- Drive保存は未実装。
- 自動同期・ポーリング・競合解決は未実装。
- トークンは保存しない。

---

## 22. Phase S5.5 実装メモ（Drive読取用OAuth接続の正式化）

Phase S5.5では、S5の手入力トークン中心フローを見直し、通常導線をGoogle認証経由へ変更する。

- 通常の「共有JSONを読み込む」操作では Google OAuth（drive.readonly）でアクセストークンを取得
- 取得トークンはメモリ利用のみ（localStorage保存しない）
- 既存S5の parse / validate / 適用 / metadata更新 / overlay再読込フローは維持
- 手入力トークンは「開発用」導線として補助扱いで残す
- 認証失敗、権限不足、Drive API未有効の可能性などをUIで明示

補足:
- Drive保存は未実装。
- 自動同期、競合解決、ポーリングは未実装。
- トークンをSharedStatePackageやJSONバックアップへ保存しない。

---

## 23. Phase S6 実装メモ（Drive共有JSONの手動保存）

Phase S6では、設定済み `sharedFileId` の既存JSONファイルへ手動保存する最小機能を追加する。

- Drive書き込み用OAuth（`drive` スコープ）でアクセストークンを取得
- 現在のローカル状態から `SharedStatePackage` を生成
- 保存直前にローカル状態スナップショットを退避（before-shared-save）
- `uploadType=media` のPATCHで既存Driveファイル本文を更新
- 保存成功時に `SharedStateMetadata` を `saved` 状態へ更新
- 保存失敗時は `failed` とエラー内容を記録し、ローカル状態は維持

制限と注意:
- Driveファイル作成は未実装
- 保存対象は通常JSONファイルのみ（Google Docs/Sheets/Slidesは対象外）
- OAuthトークンは保存しない
- 競合検知は最小（revision不一致時は警告して保存中止）
- 自動同期・ポーリング・自動保存は未実装

---

## 24. Phase S6.5 実装メモ（競合検知UI強化）

Phase S6.5では、保存前のrevision不一致時に保存を即中止するだけでなく、ユーザーが次の操作を選べるUIを追加する。

- `syncStatus = conflict` として競合状態を表示
- 競合詳細（local/remote revision、remote savedAt/savedBy など）を表示
- 選択肢:
  - Drive側を再読み込み（S5読取経路を再利用）
  - ローカル状態で上書き保存（remoteRevision + 1 で保存）
  - キャンセル（保存しない）
- 上書き保存前には必ずローカルスナップショットを作成

制限:
- 自動マージは未実装
- 競合解決は手動選択のみ
- 自動同期・ポーリング・起動時自動読取は未実装

---

## 25. Phase S7 実装メモ（起動時自動読取）

Phase S7では、ワークスペース入室時に条件付きで共有JSONを自動読取する設定と実行フローを追加する。

- `SharedStateMetadata.autoReadSharedStateOnEnter` を設定・バックアップ画面からON/OFF変更可能
- 設定値はshared-state metadataとしてlocalStorageへ保存
- ワークスペース入室後、以下条件を満たす場合のみ自動読取を試行
  - `autoReadSharedStateOnEnter === true`
  - `sharedFileId` が設定済み
  - Drive読取経路が利用可能
- 自動読取は手動読取と同じ parse / validate / workspaceCode確認 / overlay反映処理を再利用
- 認証が必要でサイレント取得できない場合はポップアップを強制せず、手動読取を促す警告を表示
- 読取失敗時はローカル状態を維持し、metadataを `failed` として記録
- Driveへの自動保存は行わない

制限:
- ポーリング、フォーカス再読取、自動保存、自動マージは未実装
- 高度な競合解決・差分UIは未実装
