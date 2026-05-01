import { requestGoogleAccessToken } from './googleAuthClient';

export type GoogleCalendarEvent = {
  id: string;
  htmlLink?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  description?: string;
};

export const MOCK_EVENTS: GoogleCalendarEvent[] = [
  {
    id: 'event-001',
    summary: '佐藤 / 第6詩 本文 / 詩集制作',
    start: { dateTime: '2026-04-27T10:00:00+09:00' },
    end: { dateTime: '2026-04-27T12:00:00+09:00' },
    description: '本文作成',
  },
  {
    id: 'event-002',
    summary: 'C / プロローグ室ラフ実装 / 展示制作',
    start: { dateTime: '2026-04-28T13:00:00+09:00' },
    end: { dateTime: '2026-04-28T16:00:00+09:00' },
    description: '',
  },
  {
    id: 'event-003',
    summary: '佐藤 / 登場人物との関係整理 / 音声作品',
    start: { dateTime: '2026-04-29T09:00:00+09:00' },
    end: { dateTime: '2026-04-29T11:00:00+09:00' },
    description: '',
  },
  {
    id: 'event-004',
    summary: '形式が間違っている予定名',
    start: { dateTime: '2026-04-30T10:00:00+09:00' },
    end: { dateTime: '2026-04-30T11:00:00+09:00' },
    description: '',
  },
  {
    id: 'event-005',
    summary: '佐藤 / 謎の作業 / 未登録プロジェクト',
    start: { dateTime: '2026-05-01T10:00:00+09:00' },
    end: { dateTime: '2026-05-01T11:00:00+09:00' },
    description: '',
  },
];

export type GoogleClientSettings = {
  oauthClientId?: string;
  useMock?: boolean;
};

let settings: GoogleClientSettings = { useMock: true };

export const initializeGoogleClient = async (next: GoogleClientSettings): Promise<void> => {
  settings = { ...settings, ...next };
};

export const isUsingMockCalendar = (): boolean => settings.useMock !== false || !settings.oauthClientId;

export const signInToGoogle = async (): Promise<void> => {
  if (settings.useMock || !settings.oauthClientId) return;
  throw new Error('MVP-1/2ではGoogleログイン実装は未対応です。');
};

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
export const GOOGLE_CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const GOOGLE_CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const buildAuthHeaders = (accessToken: string): HeadersInit => ({
  Authorization: `Bearer ${accessToken}`,
});

const toCalendarError = (status: number, fallback: string): string => {
  if (status === 401 || status === 403) {
    return 'Googleカレンダーの権限がありません。認証またはカレンダー共有設定を確認してください。';
  }
  if (status === 404) {
    return 'Googleカレンダーが見つかりません。.env.local のカレンダーIDを確認してください。';
  }
  return `${fallback}（HTTP ${status}）`;
};

const parseGoogleCalendarList = (data: unknown): GoogleCalendarEvent[] => {
  if (typeof data !== 'object' || data === null || !Array.isArray((data as { items?: unknown[] }).items)) {
    return [];
  }
  return (data as { items: GoogleCalendarEvent[] }).items.filter((event) => event.id);
};

export const fetchCalendarEvents = async (
  calendarId: string,
  accessToken?: string,
): Promise<GoogleCalendarEvent[]> => {
  if (isUsingMockCalendar()) {
    return MOCK_EVENTS;
  }

  if (!accessToken) {
    throw new Error('Googleカレンダー読取用のアクセストークンを取得できませんでした。');
  }

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 45);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 120);

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  });

  const response = await fetch(
    `${CALENDAR_API_BASE}/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: buildAuthHeaders(accessToken) },
  );

  if (!response.ok) {
    throw new Error(toCalendarError(response.status, 'Googleカレンダー予定の取得に失敗しました。'));
  }

  return parseGoogleCalendarList(await response.json());
};

export const requestGoogleCalendarReadAccessToken = async (): Promise<
  { ok: true; accessToken: string } | { ok: false; error: string }
> => {
  return requestGoogleAccessToken([GOOGLE_CALENDAR_READONLY_SCOPE]);
};

export const requestGoogleCalendarWriteAccessToken = async (): Promise<
  { ok: true; accessToken: string } | { ok: false; error: string }
> => {
  return requestGoogleAccessToken([GOOGLE_CALENDAR_EVENTS_SCOPE]);
};

export type GoogleCalendarEventPatch = Pick<GoogleCalendarEvent, 'summary' | 'start' | 'end'>;

export const updateCalendarEvent = async (params: {
  calendarId: string;
  eventId: string;
  accessToken: string;
  patch: GoogleCalendarEventPatch;
}): Promise<{ ok: true; event: GoogleCalendarEvent } | { ok: false; error: string }> => {
  if (isUsingMockCalendar()) {
    return {
      ok: false,
      error: 'モック表示中はGoogleカレンダーへ書き戻しできません。VITE_USE_MOCK_CALENDAR=false にしてください。',
    };
  }

  if (!params.accessToken.trim()) {
    return { ok: false, error: 'Googleカレンダー書き戻し用のアクセストークンを取得できませんでした。' };
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.eventId)}`,
    {
      method: 'PATCH',
      headers: {
        ...buildAuthHeaders(params.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.patch),
    },
  );

  if (!response.ok) {
    return { ok: false, error: toCalendarError(response.status, 'Googleカレンダー予定の更新に失敗しました。') };
  }

  return { ok: true, event: (await response.json()) as GoogleCalendarEvent };
};
