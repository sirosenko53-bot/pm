export type GoogleCalendarEvent = {
  id: string;
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

export const signInToGoogle = async (): Promise<void> => {
  if (settings.useMock || !settings.oauthClientId) return;
  throw new Error('MVP-1/2ではGoogleログイン実装は未対応です。');
};

export const fetchCalendarEvents = async (_calendarId: string): Promise<GoogleCalendarEvent[]> => {
  if (settings.useMock || !settings.oauthClientId) {
    return MOCK_EVENTS;
  }

  throw new Error('Google Calendar API本接続はこの環境で未設定です。モックを利用してください。');
};
