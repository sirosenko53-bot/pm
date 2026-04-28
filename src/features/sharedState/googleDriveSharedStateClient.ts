const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';

const GOOGLE_WORKSPACE_MIME_PREFIX = 'application/vnd.google-apps.';

const buildAuthHeaders = (accessToken: string): HeadersInit => ({
  Authorization: `Bearer ${accessToken}`,
});

type DriveFileMeta = { name?: string; mimeType?: string; modifiedTime?: string };

const fetchDriveFileMeta = async (
  fileId: string,
  accessToken: string,
): Promise<{ ok: true; meta: DriveFileMeta } | { ok: false; error: string }> => {
  const metaRes = await fetch(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime`,
    { headers: buildAuthHeaders(accessToken) },
  );

  if (!metaRes.ok) {
    if (metaRes.status === 401 || metaRes.status === 403) {
      return { ok: false, error: 'Google認証に失敗しました。Drive読取権限がありません。' };
    }
    if (metaRes.status === 404) {
      return { ok: false, error: '指定したDriveファイルが見つかりません。fileIdを確認してください。' };
    }
    return {
      ok: false,
      error: `Driveファイルにアクセスできません。Drive APIが有効でない可能性があります（HTTP ${metaRes.status}）。`,
    };
  }

  const meta = (await metaRes.json()) as DriveFileMeta;
  if ((meta.mimeType ?? '').startsWith(GOOGLE_WORKSPACE_MIME_PREFIX)) {
    return {
      ok: false,
      error:
        'Google Drive上の通常JSONファイルを指定してください。Googleドキュメントやスプレッドシートはこの段階では対象外です。',
    };
  }

  return { ok: true, meta };
};

export async function fetchDriveJsonFile(params: {
  fileId: string;
  accessToken: string;
}): Promise<{ ok: true; text: string; fileName: string } | { ok: false; error: string }> {
  const fileId = params.fileId.trim();
  const accessToken = params.accessToken.trim();

  if (!fileId) {
    return { ok: false, error: 'DriveファイルIDが未設定です。' };
  }

  if (!accessToken) {
    return { ok: false, error: 'Drive読取用のアクセストークンを入力してください。' };
  }

  try {
    const metaResult = await fetchDriveFileMeta(fileId, accessToken);
    if (!metaResult.ok) return metaResult;

    const mediaRes = await fetch(`${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`, {
      headers: buildAuthHeaders(accessToken),
    });

    if (!mediaRes.ok) {
      if (mediaRes.status === 401 || mediaRes.status === 403) {
        return { ok: false, error: 'Drive読取権限がありません。Google認証をやり直してください。' };
      }
      return { ok: false, error: `Driveファイルにアクセスできません（HTTP ${mediaRes.status}）。` };
    }

    const text = await mediaRes.text();
    if (!text.trim()) {
      return { ok: false, error: 'Driveファイルが空です。JSON内容を確認してください。' };
    }

    return { ok: true, text, fileName: metaResult.meta.name ?? 'shared-state.json' };
  } catch {
    return { ok: false, error: 'Drive通信に失敗しました。ネットワークまたはDrive API有効化状態を確認してください。' };
  }
}

export async function updateDriveJsonFile(params: {
  fileId: string;
  accessToken: string;
  jsonText: string;
}): Promise<{ ok: true; modifiedTime?: string } | { ok: false; error: string }> {
  const fileId = params.fileId.trim();
  const accessToken = params.accessToken.trim();

  if (!fileId) {
    return { ok: false, error: 'sharedFileIdが未設定です。' };
  }
  if (!accessToken) {
    return { ok: false, error: 'Drive書き込み用アクセストークンを取得できませんでした。' };
  }

  try {
    const metaResult = await fetchDriveFileMeta(fileId, accessToken);
    if (!metaResult.ok) {
      return {
        ok: false,
        error: metaResult.error.includes('読取権限')
          ? 'Drive書き込み権限がありません。'
          : metaResult.error,
      };
    }

    const response = await fetch(
      `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(fileId)}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          ...buildAuthHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: params.jsonText,
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: 'Drive書き込み権限がありません。' };
      }
      if (response.status === 404) {
        return { ok: false, error: 'Driveファイルが見つかりません。' };
      }
      return { ok: false, error: `Driveファイル更新に失敗しました（HTTP ${response.status}）。` };
    }

    const data = (await response.json()) as { modifiedTime?: string };
    return { ok: true, modifiedTime: data.modifiedTime };
  } catch {
    return { ok: false, error: 'Driveファイル更新中に通信エラーが発生しました。' };
  }
}
