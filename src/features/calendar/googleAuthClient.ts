const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

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
  if (!clientId) {
    throw new Error('Google OAuthクライアントIDが未設定です（VITE_GOOGLE_OAUTH_CLIENT_ID）。');
  }
  return clientId;
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
  options?: { prompt?: string },
): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> => {
  try {
    await loadGsiScript();
    const clientId = getGoogleClientId();

    const googleGlobal = (window as Window & { google?: GoogleGlobal }).google;
    if (!googleGlobal?.accounts?.oauth2) {
      return { ok: false, error: 'Google認証クライアントの初期化に失敗しました。' };
    }

    const tokenResult = await new Promise<{ ok: true; accessToken: string } | { ok: false; error: string }>((resolve) => {
      const tokenClient = googleGlobal.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: (response) => {
          if (!response.access_token) {
            resolve({ ok: false, error: toUserMessage(response) });
            return;
          }
          resolve({ ok: true, accessToken: response.access_token });
        },
      });

      tokenClient.requestAccessToken({ prompt: options?.prompt ?? 'consent' });
    });

    return tokenResult;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Google認証に失敗しました。',
    };
  }
};
