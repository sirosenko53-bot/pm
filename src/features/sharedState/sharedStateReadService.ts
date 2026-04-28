import type { Workspace } from '../../domain/workspaceTypes';
import { fetchDriveJsonFile } from './googleDriveSharedStateClient';
import {
  applySharedStatePackage,
  backupCurrentLocalStateBeforeSharedRead,
  parseSharedStateJson,
  validateSharedStatePackage,
} from './sharedStatePackageService';
import { markSharedStateReadFailed, markSharedStateReadSuccess } from './sharedStateStore';
import type { SharedStateMetadata } from './sharedStateTypes';
import { getAllTaskOverlays } from '../tasks/taskOverlayStore';

export type SharedStateReadParams = {
  appVersion: string;
  workspace: Workspace;
  metadata: SharedStateMetadata;
  fileId: string;
  accessToken: string;
  lastSyncedAt: string | null;
};

export type SharedStateReadResult =
  | {
      ok: true;
      metadata: SharedStateMetadata;
      message: string;
      warning?: string;
    }
  | {
      ok: false;
      metadata: SharedStateMetadata;
      error: string;
      warning?: string;
    };

export const readSharedStateFromDrive = async (
  params: SharedStateReadParams,
): Promise<SharedStateReadResult> => {
  const fetchResult = await fetchDriveJsonFile({
    fileId: params.fileId,
    accessToken: params.accessToken,
  });
  if (!fetchResult.ok) {
    const failed = markSharedStateReadFailed(fetchResult.error);
    return {
      ok: false,
      metadata: failed.value,
      error: fetchResult.error,
      warning: failed.warning,
    };
  }

  const parsed = parseSharedStateJson(fetchResult.text);
  if (!parsed.ok) {
    const failed = markSharedStateReadFailed(parsed.error);
    return {
      ok: false,
      metadata: failed.value,
      error: parsed.error,
      warning: failed.warning,
    };
  }

  if (parsed.data.workspaceCode !== params.workspace.workspaceCode) {
    const mismatchMessage = `workspaceCodeが一致しません。期待: ${params.workspace.workspaceCode} / 取得: ${parsed.data.workspaceCode}`;
    const failed = markSharedStateReadFailed(mismatchMessage);
    return {
      ok: false,
      metadata: failed.value,
      error: mismatchMessage,
      warning: failed.warning,
    };
  }

  const validation = validateSharedStatePackage(parsed.data);
  if (!validation.ok) {
    const errorMessage = `共有JSONの検証に失敗しました。\n${validation.errors.join('\n')}`;
    const failed = markSharedStateReadFailed(errorMessage);
    return {
      ok: false,
      metadata: failed.value,
      error: errorMessage,
      warning: failed.warning,
    };
  }

  const snapshot = backupCurrentLocalStateBeforeSharedRead({
    appVersion: params.appVersion,
    workspace: params.workspace,
    lastSyncedAt: params.lastSyncedAt,
    taskOverlays: getAllTaskOverlays(),
  });

  const applyResult = applySharedStatePackage(parsed.data);
  if (!applyResult.ok) {
    const failedMessage = applyResult.warning ?? '共有状態の反映に失敗しました。';
    const failed = markSharedStateReadFailed(failedMessage);
    return {
      ok: false,
      metadata: failed.value,
      error: failedMessage,
      warning: failed.warning,
    };
  }

  const success = markSharedStateReadSuccess({
    fileId: params.fileId,
    fileName: params.metadata.sharedFileName ?? fetchResult.fileName,
    revision: parsed.data.revision,
    savedAt: parsed.data.savedAt,
    savedBy: parsed.data.savedBy,
    deviceId: parsed.data.deviceId,
  });

  return {
    ok: true,
    metadata: success.value,
    message: `共有JSONを読み込み、TaskOverlayを反映しました（${parsed.data.taskOverlays.length}件）。`,
    warning: success.warning ?? snapshot.warning ?? applyResult.warning,
  };
};
