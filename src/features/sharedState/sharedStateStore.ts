import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';
import {
  createInitialSharedStateMetadata,
  DEFAULT_SHARED_STATE_FILE_NAME,
  type SharedStateMetadata,
  type SharedStateSource,
} from './sharedStateTypes';

const SHARED_STATE_META_KEY = 'seisaku-pm:shared-state-meta';

const extractDriveFileIdFromInput = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';

  const drivePattern = /\/d\/([a-zA-Z0-9_-]+)/;
  const driveMatched = trimmed.match(drivePattern);
  if (driveMatched?.[1]) {
    return driveMatched[1];
  }

  const queryPattern = /[?&]id=([a-zA-Z0-9_-]+)/;
  const queryMatched = trimmed.match(queryPattern);
  if (queryMatched?.[1]) {
    return queryMatched[1];
  }

  return trimmed;
};

export const loadSharedStateMetadata = (): { value: SharedStateMetadata; warning?: string } =>
  loadFromStorage<SharedStateMetadata>(SHARED_STATE_META_KEY, createInitialSharedStateMetadata());

export const saveSharedStateMetadata = (metadata: SharedStateMetadata): { ok: boolean; warning?: string } =>
  saveToStorage(SHARED_STATE_META_KEY, metadata);

export const patchSharedStateMetadata = (
  patch: Partial<SharedStateMetadata>,
): { value: SharedStateMetadata; warning?: string } => {
  const current = loadSharedStateMetadata();
  const next: SharedStateMetadata = {
    ...current.value,
    ...patch,
  };
  const result = saveSharedStateMetadata(next);
  return { value: next, warning: current.warning ?? result.warning };
};

export const saveSharedDriveFileSettings = (params: {
  sharedFileId: string;
  sharedFileName?: string;
}): { value?: SharedStateMetadata; warning?: string } => {
  const normalizedId = extractDriveFileIdFromInput(params.sharedFileId);
  if (normalizedId.length === 0) {
    return { warning: 'DriveファイルIDを入力してください。' };
  }

  const normalizedName = params.sharedFileName?.trim() || DEFAULT_SHARED_STATE_FILE_NAME;
  const result = patchSharedStateMetadata({
    sharedFileId: normalizedId,
    sharedFileName: normalizedName,
    syncStatus: 'idle',
    lastReadError: null,
  });

  if (normalizedId.length < 10 && !result.warning) {
    return {
      value: result.value,
      warning: 'DriveファイルIDが短すぎる可能性があります。入力内容を確認してください。',
    };
  }

  return result;
};

export const clearSharedDriveFileSettings = (): { value: SharedStateMetadata; warning?: string } =>
  patchSharedStateMetadata({
    sharedFileId: null,
    sharedFileName: null,
    syncStatus: 'idle',
  });

export const setAutoReadSharedStateOnEnter = (
  enabled: boolean,
): { value: SharedStateMetadata; warning?: string } =>
  patchSharedStateMetadata({
    autoReadSharedStateOnEnter: enabled,
  });

export const markSharedStateReadSuccess = (params: {
  fileName?: string;
  fileId?: string | null;
  revision: number;
  savedAt?: string | null;
  savedBy?: string | null;
  deviceId?: string | null;
}): { value: SharedStateMetadata; warning?: string } =>
  patchSharedStateMetadata({
    source: 'shared-json',
    syncStatus: 'loaded',
    sharedFileName: params.fileName ?? DEFAULT_SHARED_STATE_FILE_NAME,
    sharedFileId: params.fileId ?? null,
    revision: params.revision,
    loadedRevision: params.revision,
    savedAt: params.savedAt ?? null,
    savedBy: params.savedBy ?? null,
    deviceId: params.deviceId ?? null,
    lastReadAt: new Date().toISOString(),
    lastReadError: null,
    hasLocalChangesAfterShare: false,
  });

export const markSharedStateReadFailed = (
  errorMessage: string,
): { value: SharedStateMetadata; warning?: string } =>
  patchSharedStateMetadata({
    source: 'shared-json-read-failed',
    syncStatus: 'failed',
    lastReadAt: new Date().toISOString(),
    lastReadError: errorMessage,
  });

export const markSharedStateSaveFailed = (
  errorMessage: string,
): { value: SharedStateMetadata; warning?: string } =>
  patchSharedStateMetadata({
    syncStatus: 'failed',
    lastReadError: errorMessage,
    hasLocalChangesAfterShare: true,
  });

export const markSharedStateConflict = (
  errorMessage: string,
): { value: SharedStateMetadata; warning?: string } =>
  patchSharedStateMetadata({
    syncStatus: 'conflict',
    lastReadError: errorMessage,
    hasLocalChangesAfterShare: true,
  });

export const markSharedStateSaved = (params: {
  revision: number;
  savedBy: string;
  deviceId?: string;
  fileName?: string;
  fileId?: string | null;
}): { value: SharedStateMetadata; warning?: string } => {
  const savedAt = new Date().toISOString();
  return patchSharedStateMetadata({
    source: 'shared-json',
    syncStatus: 'saved',
    sharedFileName: params.fileName ?? DEFAULT_SHARED_STATE_FILE_NAME,
    sharedFileId: params.fileId ?? null,
    revision: params.revision,
    loadedRevision: params.revision,
    savedAt,
    savedBy: params.savedBy,
    deviceId: params.deviceId ?? null,
    lastSaveAt: savedAt,
    lastReadError: null,
    hasLocalChangesAfterShare: false,
  });
};

export const markLocalChangesAfterSharedRead = (): { value: SharedStateMetadata; warning?: string } =>
  patchSharedStateMetadata({
    hasLocalChangesAfterShare: true,
    syncStatus: 'idle',
  });

export const setSharedStateSource = (
  source: SharedStateSource,
): { value: SharedStateMetadata; warning?: string } => patchSharedStateMetadata({ source });


export const setSharedStateSyncStatus = (
  syncStatus: SharedStateMetadata['syncStatus'],
): { value: SharedStateMetadata; warning?: string } => patchSharedStateMetadata({ syncStatus });

export const clearSharedStateMetadata = (): { ok: boolean; warning?: string } =>
  saveSharedStateMetadata(createInitialSharedStateMetadata());
