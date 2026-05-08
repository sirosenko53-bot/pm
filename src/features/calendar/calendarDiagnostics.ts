import type { Task } from '../../domain/taskTypes';
import type { CalendarSource, Workspace } from '../../domain/workspaceTypes';
import type { GoogleCalendarEvent } from './googleCalendarClient';

const PLACEHOLDER_CALENDAR_IDS = new Set([
  'cal-poetry@example.com',
  'cal-exhibition@example.com',
  'cal-audio@example.com',
  'cal-novel@example.com',
]);

const readEnvText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export type CalendarSourceSetup = {
  calendarSourceId: string;
  displayName: string;
  projectId: string;
  calendarId: string;
};

export type CalendarConnectionDiagnostic = {
  isMockMode: boolean;
  hasOAuthClientId: boolean;
  totalSources: number;
  configuredSources: number;
  missingSources: CalendarSourceSetup[];
  readyForGoogleRead: boolean;
  statusLabel: string;
  nextAction: string;
  detail: string;
};

export type CalendarImportSourceSummary = {
  calendarSourceId: string;
  displayName: string;
  projectId: string;
  eventCount: number;
  taskCount: number;
  skipped: boolean;
  skipReason?: string;
};

export type CalendarImportSummary = {
  mode: 'mock' | 'google';
  updatedAt: string;
  totalEvents: number;
  totalTasks: number;
  parseErrorCount: number;
  delayedCount: number;
  skippedSourceCount: number;
  sourceSummaries: CalendarImportSourceSummary[];
};

export type CalendarSourceImportResult = {
  source: CalendarSource;
  events: GoogleCalendarEvent[];
  tasks: Task[];
  skipped?: boolean;
  skipReason?: string;
};

export const isPlaceholderCalendarId = (calendarId: string): boolean =>
  PLACEHOLDER_CALENDAR_IDS.has(calendarId.trim());

export const buildCalendarConnectionDiagnostic = (workspace: Workspace): CalendarConnectionDiagnostic => {
  const useMockCalendar = readEnvText(import.meta.env.VITE_USE_MOCK_CALENDAR) !== 'false';
  const hasOAuthClientId = Boolean(readEnvText(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID));
  const missingSources = workspace.calendarSources
    .filter((source) => !source.calendarId.trim() || isPlaceholderCalendarId(source.calendarId))
    .map((source) => ({
      calendarSourceId: source.calendarSourceId,
      displayName: source.displayName,
      projectId: source.projectId,
      calendarId: source.calendarId,
    }));
  const configuredSources = workspace.calendarSources.length - missingSources.length;
  const isMockMode = useMockCalendar || !hasOAuthClientId;
  const readyForGoogleRead = !useMockCalendar && hasOAuthClientId && missingSources.length === 0;

  if (useMockCalendar) {
    return {
      isMockMode,
      hasOAuthClientId,
      totalSources: workspace.calendarSources.length,
      configuredSources,
      missingSources,
      readyForGoogleRead,
      statusLabel: 'モック表示中',
      nextAction: '実カレンダーを使う場合は .env.local の VITE_USE_MOCK_CALENDAR=false を確認してください。',
      detail: '予定の取り込みボタンは使えますが、現在はサンプル予定を表示します。',
    };
  }

  if (!hasOAuthClientId) {
    return {
      isMockMode,
      hasOAuthClientId,
      totalSources: workspace.calendarSources.length,
      configuredSources,
      missingSources,
      readyForGoogleRead,
      statusLabel: 'OAuth Client ID 未設定',
      nextAction: '.env.local に VITE_GOOGLE_OAUTH_CLIENT_ID を設定するとGoogle認証を開始できます。',
      detail: 'Client Secretは不要です。OAuthトークンは保存しません。',
    };
  }

  if (missingSources.length > 0) {
    return {
      isMockMode,
      hasOAuthClientId,
      totalSources: workspace.calendarSources.length,
      configuredSources,
      missingSources,
      readyForGoogleRead,
      statusLabel: '一部カレンダーID未設定',
      nextAction: '未設定のプロジェクトは読み飛ばし、設定済みのカレンダーだけ取り込みます。',
      detail: '後で .env.local に未設定プロジェクトの VITE_CALENDAR_ID_* を追加すると読み込み対象になります。',
    };
  }

  return {
    isMockMode,
    hasOAuthClientId,
    totalSources: workspace.calendarSources.length,
    configuredSources,
    missingSources,
    readyForGoogleRead,
    statusLabel: '実カレンダー読取準備OK',
    nextAction: '「Googleカレンダーを取り込む」を押すと、共有済みカレンダーから予定を読み込みます。',
    detail: 'Googleカレンダーはread-onlyです。予定名や日時の書き戻しはプレビュー確認後の操作だけで実行します。',
  };
};

export const buildCalendarImportSummary = (params: {
  useMockCalendar: boolean;
  sourceResults: CalendarSourceImportResult[];
  updatedAt: string;
}): CalendarImportSummary => {
  const allTasks = params.sourceResults.flatMap((result) => result.tasks);
  const allEvents = params.sourceResults.flatMap((result) => result.events);

  return {
    mode: params.useMockCalendar ? 'mock' : 'google',
    updatedAt: params.updatedAt,
    totalEvents: allEvents.length,
    totalTasks: allTasks.length,
    parseErrorCount: allTasks.filter((task) => task.parseError).length,
    delayedCount: allTasks.filter((task) => {
      const due = task.dueDate || task.endDateTime || task.startDateTime;
      if (!due) return false;
      return new Date(due).getTime() < Date.now();
    }).length,
    skippedSourceCount: params.sourceResults.filter((result) => result.skipped).length,
    sourceSummaries: params.sourceResults.map((result) => ({
      calendarSourceId: result.source.calendarSourceId,
      displayName: result.source.displayName,
      projectId: result.source.projectId,
      eventCount: result.events.length,
      taskCount: result.tasks.length,
      skipped: Boolean(result.skipped),
      skipReason: result.skipReason,
    })),
  };
};
