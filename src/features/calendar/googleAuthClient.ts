const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DEFAULT_TOKEN_TIMEOUT_MS = 60_000;
const DEFAULT_GOOGLE_OAUTH_CLIENT_ID = '969800358154-ireokpv3pq6sak6rnd7qn9lj07k94pq2.apps.googleusercontent.com';

let gsiLoadPromise: Promise<void> | null = null;

const loadGsiScript = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    throw new Error('ブラウザ環境でのみGoogle認証を利用できます。');
  }

  if ((window as Window & { google?: unknown }).google) {
    return;
  }

  if (!gsiLoadPromise) {
    gsiLoadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google認証スクリプトの読み込みに失敗しました。'));
      document.head.append(script);
    });
  }

  await gsiLoadPromise;
};

type GoogleTokenClientResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (params?: { prompt?: string }) => void;
};

type GoogleOauth2 = {
  initTokenClient: (params: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenClientResponse) => void;
  }) => GoogleTokenClient;
};

type GoogleAccounts = {
  oauth2: GoogleOauth2;
};

type GoogleGlobal = {
  accounts: GoogleAccounts;
};

const getGoogleClientId = (): string => {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  return clientId?.trim() || DEFAULT_GOOGLE_OAUTH_CLIENT_ID;
};

const toUserMessage = (response: GoogleTokenClientResponse): string => {
  if (response.error === 'access_denied') {
    return 'Google認証に失敗しました。権限許可を確認してください。';
  }
  if (response.error === 'popup_closed_by_user') {
    return 'Google認証がキャンセルされました。';
  }
  return response.error_description ?? response.error ?? 'Google認証に失敗しました。';
};

export const requestGoogleAccessToken = async (
  scopes: string[],
  options?: { prompt?: string; timeoutMs?: number },
): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> => {
  try {
    await loadGsiScript();
    const clientId = getGoogleClientId();

    const googleGlobal = (window as Window & { google?: GoogleGlobal }).google;
    if (!googleGlobal?.accounts?.oauth2) {
      return { ok: false, error: 'Google認証クライアントの初期化に失敗しました。' };
    }

    const tokenResult = await new Promise<{ ok: true; accessToken: string } | { ok: false; error: string }>((resolve) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({
          ok: false,
          error: 'Google認証が完了しませんでした。ポップアップブロックや認証画面の状態を確認して、もう一度実行してください。',
        });
      }, options?.timeoutMs ?? DEFAULT_TOKEN_TIMEOUT_MS);
      const finish = (result: { ok: true; accessToken: string } | { ok: false; error: string }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(result);
      };

      const tokenClient = googleGlobal.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: (response) => {
          if (!response.access_token) {
            finish({ ok: false, error: toUserMessage(response) });
            return;
          }
          finish({ ok: true, accessToken: response.access_token });
        },
      });

      try {
        tokenClient.requestAccessToken({ prompt: options?.prompt ?? 'consent' });
      } catch (error) {
        finish({
          ok: false,
          error: error instanceof Error ? error.message : 'Google認証の開始に失敗しました。',
        });
      }
    });

    return tokenResult;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Google認証に失敗しました。',
    };
  }
};
