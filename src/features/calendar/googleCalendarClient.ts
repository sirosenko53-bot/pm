import { requestGoogleAccessToken } from './googleAuthClient';

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  description?: string;
};

type GoogleCalendarApiEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  description?: string;
};

type GoogleCalendarApiListResponse = {
  items?: GoogleCalendarApiEvent[];
  error?: {
    message?: string;
  };
};

const CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_CALENDAR_EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars';
const FALLBACK_CALENDAR_ID_PATTERN = /^cal-[a-z-]+@example\.com$/;

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
let accessTokenPromise: Promise<string> | null = null;

export const initializeGoogleClient = async (next: GoogleClientSettings): Promise<void> => {
  settings = { ...settings, ...next };
};

export const signInToGoogle = async (): Promise<void> => {
  if (settings.useMock) return;
  await getReadOnlyAccessToken();
};

const getReadOnlyAccessToken = async (): Promise<string> => {
  if (!accessTokenPromise) {
    accessTokenPromise = requestGoogleAccessToken([CALENDAR_READONLY_SCOPE]).then((result) => {
      if (!result.ok) {
        accessTokenPromise = null;
        throw new Error(result.error);
      }
      return result.accessToken;
    });
  }
  return accessTokenPromise;
};

const assertRealCalendarId = (calendarId: string) => {
  if (!calendarId.trim()) {
    throw new Error('GoogleカレンダーIDが未設定です。.env.local に VITE_CALENDAR_ID_* を設定してください。');
  }
  if (FALLBACK_CALENDAR_ID_PATTERN.test(calendarId)) {
    throw new Error(
      'GoogleカレンダーIDが仮IDのままです。.env.local に実カレンダーIDを設定するか、VITE_USE_MOCK_CALENDAR=true にしてください。',
    );
  }
};

const toApiEvent = (event: GoogleCalendarApiEvent): GoogleCalendarEvent | null => {
  if (!event.id) return null;
  return {
    id: event.id,
    summary: event.summary,
    start: event.start,
    end: event.end,
    description: event.description,
  };
};

const createEventsUrl = (calendarId: string): string => {
  const url = new URL(`${GOOGLE_CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`);
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(now.getDate() - 90);
  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + 365);

  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('maxResults', '2500');
  return url.toString();
};

export const fetchCalendarEvents = async (calendarId: string): Promise<GoogleCalendarEvent[]> => {
  if (settings.useMock) {
    return MOCK_EVENTS;
  }
  if (!settings.oauthClientId) {
    throw new Error('Google OAuthクライアントIDが未設定です（VITE_GOOGLE_OAUTH_CLIENT_ID）。');
  }

  assertRealCalendarId(calendarId);
  const accessToken = await getReadOnlyAccessToken();
  const response = await fetch(createEventsUrl(calendarId), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleCalendarApiListResponse;

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      accessTokenPromise = null;
    }
    throw new Error(payload.error?.message ?? 'Googleカレンダーの予定取得に失敗しました。');
  }

  return (payload.items ?? [])
    .map(toApiEvent)
    .filter((event): event is GoogleCalendarEvent => Boolean(event));
};
