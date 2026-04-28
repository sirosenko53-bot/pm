import { requestGoogleAccessToken } from '../calendar/googleAuthClient';

export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_WRITE_SCOPE = 'https://www.googleapis.com/auth/drive';

export const getDriveReadAccessToken = async (): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> => {
  const result = await requestGoogleAccessToken([DRIVE_READONLY_SCOPE]);

  if (!result.ok) {
    return { ok: false, error: result.error.includes('Google認証') ? result.error : `Google認証に失敗しました。${result.error}` };
  }

  return result;
};

export const tryGetDriveReadAccessTokenSilently = async (): Promise<
  { ok: true; accessToken: string } | { ok: false; error: string }
> => {
  const result = await requestGoogleAccessToken([DRIVE_READONLY_SCOPE], { prompt: 'none' });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return result;
};

export const getDriveWriteAccessToken = async (): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> => {
  const result = await requestGoogleAccessToken([DRIVE_WRITE_SCOPE]);

  if (!result.ok) {
    return { ok: false, error: result.error.includes('Google認証') ? result.error : `Google認証に失敗しました。${result.error}` };
  }

  return result;
};
