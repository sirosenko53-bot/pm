# プロジェクトコード参加方式 運用メモ

## 1. 目的

プロジェクトコード参加方式は、担当者ごとの細かい権限表を作らず、プロジェクトごとのコードを共有することで参加プロジェクトを増やすための仕組みです。

この方式は、Discordなどでコードを共有できる信頼メンバー向けの簡易表示制御です。ユーザー認証やサーバー側の権限制御ではないため、厳密な認証や秘匿管理としては扱いません。

## 2. 現在の実装

現在の実装では、以下の型と保存キーを使います。

- `ProjectAccessCode`: 入力コード、表示ラベル、対象projectId、既定projectId、アクセスモードを定義する型
- `JoinedProject`: この端末で参加済みのプロジェクトを表す型
- `seisaku-pm:joined-projects`: 参加中プロジェクト一覧のlocalStorage保存キー
- `seisaku-pm:project-access-mode`: 通常モード / admin mode のlocalStorage保存キー

初期コードは以下です。

- `tokigire-poetry`: 詩集制作に参加するコード
- `tokigire-exhibition`: 展示制作に参加するコード
- `tokigire-audio`: 音声作品に参加するコード
- `tokigire-admin`: 管理者用。全プロジェクトを表示するコード
- `tokigire`: 既存検証用コードの互換。`tokigire-admin` 相当として扱う

## 3. 現在の運用

プロジェクトコードはDiscordなどで必要な参加者に共有します。参加者は初回にコードを入力し、対象プロジェクトをこの端末のlocalStorageに保存します。

参加済みプロジェクトが複数ある場合は、参加中プロジェクト一覧から開くプロジェクトを選びます。追加で参加する場合は、同じ一覧画面からプロジェクトコードを追加します。

「参加中から外す」操作は、localStorage上の参加状態から外すだけです。Googleカレンダー予定、TaskOverlay、JSONバックアップ、Drive共有JSON、プロジェクト定義は削除しません。

## 4. プロジェクトを追加する場合

新しいプロジェクトを追加する場合は、まず設定ファイル運用で対応します。現段階では管理者画面やプロジェクト追加UIは作りません。

作業手順は以下を基本にします。

1. `projectAccessCodes` に新しい `ProjectAccessCode` を追加する
2. workspace / project 定義に対象の `projectId` を追加する
3. Googleカレンダー命名規則と `projectId` の対応を確認する
4. `npm run build` で型チェックとビルドを確認する
5. ブラウザでコード入力、参加中プロジェクト一覧、表示フィルターを確認する

## 5. 将来の管理者コード運用

将来的には、`tokigire-admin` を入力した場合だけ設定編集UIを出す構想があります。たとえば、プロジェクト追加、アクセスコード追加、表示対象の確認などです。

ただし、現段階では未実装です。将来実装する場合も、本格的なセキュリティや権限管理ではなく、身内向けの簡易管理として扱います。

## 6. 今回やらないこと

この段階では、以下は実装しません。

- 管理者画面
- プロジェクト追加UI
- アクセスコード編集UI
- ユーザー認証
- Firebase / Firestore / Supabase / 独自サーバー
- Googleカレンダー書き戻し

## 7. Googleカレンダーのプロジェクト別運用

Googleカレンダーはプロジェクトごとに分けて運用します。たとえば、詩集制作カレンダー、展示制作カレンダー、音声作品カレンダー、小説執筆カレンダーを別々に用意します。

`workspaceConfig.ts` の `calendarSources` では、`calendarSource.calendarId` を `.env.local` の環境変数から読み取り、`calendarSource.projectId` に対応する制作PM側の `projectId` を設定します。実際のGoogleカレンダーIDはGit管理するファイルへ直書きしません。

予定名は原則として `担当者/予定名/プロジェクト名` の形式にします。予定名から解析したプロジェクト名が `workspace.projects.projectName` と一致する場合は、そのプロジェクトを優先します。一致しない場合、または予定名が命名規則どおりに解析できない場合は、予定を取得した `calendarSource.projectId` をプロジェクト判定のfallbackとして使います。

このfallbackにより、プロジェクト別カレンダーに入っている予定は、予定名が多少崩れていても対象プロジェクトへ分類できます。ただし、命名規則違反の `parseError` は警告として残します。

Googleカレンダーはread-onlyで読み取ります。Googleカレンダーへの書き戻し、予定作成、予定更新、予定削除は未実装です。

### 7.1 GoogleカレンダーIDの設定

実運用のGoogleカレンダーIDは `.env.local` に設定します。`.env.local` はGit管理しません。

```env
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_USE_MOCK_CALENDAR=false

VITE_CALENDAR_ID_POETRY=dummy-poetry-calendar-id
VITE_CALENDAR_ID_EXHIBITION=dummy-exhibition-calendar-id
VITE_CALENDAR_ID_AUDIO=dummy-audio-calendar-id
VITE_CALENDAR_ID_NOVEL=dummy-novel-calendar-id
```

GoogleカレンダーIDは、Googleカレンダーの「設定と共有」から対象カレンダーを開き、「カレンダーの統合」内の「カレンダーID」で確認します。

`VITE_USE_MOCK_CALENDAR=false` のときは、Google Calendar APIをread-only scopeで呼び出して実カレンダー読取を行います。取得対象は直近90日前から365日後までの予定です。

`VITE_CALENDAR_ID_POETRY`、`VITE_CALENDAR_ID_EXHIBITION`、`VITE_CALENDAR_ID_AUDIO`、`VITE_CALENDAR_ID_NOVEL` が未設定の場合、`workspaceConfig.ts` の仮IDが使われるため、実読取は失敗します。実読取を使う場合は、対象カレンダーIDと `VITE_GOOGLE_OAUTH_CLIENT_ID` を `.env.local` に設定してください。

## 8. 注意点

`joined projects` は端末ごとの表示設定です。チーム全体で共有する状態ではないため、Drive共有JSONには含めません。

Drive共有JSONは、TaskOverlayやviewPreferenceなどのチーム共有状態を扱います。参加中プロジェクトまで共有すると、各メンバーの表示範囲が混ざる可能性があります。

OAuthトークンは保存しません。`accessToken`、`refreshToken`、`id_token` をlocalStorage、JSONバックアップ、Drive共有JSONに含めない方針を維持します。
