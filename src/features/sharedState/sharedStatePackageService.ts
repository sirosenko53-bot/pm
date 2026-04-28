import type { TaskOverlay } from '../../domain/taskTypes';
import { WORKFLOW_TEMPLATES } from '../../config/workflowTemplates';
import type { Workspace } from '../../domain/workspaceTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';
import {
  createBackupPackage,
  loadViewPreference,
  saveViewPreference,
} from '../backup/backupService';
import { replaceAllTaskOverlays } from '../tasks/taskOverlayStore';
import {
  SHARED_STATE_SCHEMA_VERSION,
  type SharedStateMetadata,
  type SharedStatePackage,
  type SharedStateValidationResult,
} from './sharedStateTypes';

const SHARED_READ_SNAPSHOT_KEY = 'seisaku-pm:shared-read-snapshot';
const SHARED_SAVE_SNAPSHOT_KEY = 'seisaku-pm:shared-save-snapshot';
const DEVICE_ID_KEY = 'seisaku-pm:device-id';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getOrCreateDeviceId = (): string => {
  const existing = loadFromStorage<string | null>(DEVICE_ID_KEY, null).value;
  if (existing) return existing;
  const created = `device-${Math.random().toString(36).slice(2, 10)}`;
  saveToStorage(DEVICE_ID_KEY, created);
  return created;
};

export const parseSharedStateJson = (
  text: string,
): { ok: true; data: SharedStatePackage } | { ok: false; error: string } => {
  try {
    return { ok: true, data: JSON.parse(text) as SharedStatePackage };
  } catch {
    return { ok: false, error: '共有JSONの解析に失敗しました。JSON形式を確認してください。' };
  }
};

export const validateSharedStatePackage = (data: unknown): SharedStateValidationResult => {
  const errors: string[] = [];

  if (!isRecord(data)) {
    return { ok: false, errors: ['共有JSONのルートがオブジェクトではありません。'] };
  }

  if (data.app !== 'seisaku-pm') {
    errors.push('app が seisaku-pm ではありません。');
  }

  if (data.sharedStateSchemaVersion !== SHARED_STATE_SCHEMA_VERSION) {
    errors.push('sharedStateSchemaVersion が未対応です。');
  }

  if (!Array.isArray(data.taskOverlays)) {
    errors.push('taskOverlays が配列ではありません。');
  } else {
    data.taskOverlays.forEach((overlay, index) => {
      if (!isRecord(overlay)) {
        errors.push(`taskOverlays[${index}] がオブジェクトではありません。`);
        return;
      }
      if (typeof overlay.taskId !== 'string' || overlay.taskId.length === 0) {
        errors.push(`taskOverlays[${index}].taskId が不正です。`);
      }
      if (typeof overlay.googleCalendarEventId !== 'string' || overlay.googleCalendarEventId.length === 0) {
        errors.push(`taskOverlays[${index}].googleCalendarEventId が不正です。`);
      }
      if (typeof overlay.status !== 'string' || overlay.status.length === 0) {
        errors.push(`taskOverlays[${index}].status が不正です。`);
      }
      if (overlay.sortOrder !== undefined && typeof overlay.sortOrder !== 'number') {
        errors.push(`taskOverlays[${index}].sortOrder は number である必要があります。`);
      }
      if (typeof overlay.updatedAt !== 'string' || overlay.updatedAt.length === 0) {
        errors.push(`taskOverlays[${index}].updatedAt が不正です。`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
};

export const createSharedStatePackage = (params: {
  workspace: Workspace;
  taskOverlays: TaskOverlay[];
  metadata: SharedStateMetadata;
  savedBy?: string;
  deviceId?: string;
  lastSyncedAt?: string | null;
  revisionBase?: number;
}): SharedStatePackage => {
  const savedAt = new Date().toISOString();
  const baseRevision = params.revisionBase ?? params.metadata.revision;
  const revision = baseRevision > 0 ? baseRevision + 1 : 1;
  const deviceId = params.deviceId ?? params.metadata.deviceId ?? getOrCreateDeviceId();

  return {
    app: 'seisaku-pm',
    sharedStateSchemaVersion: SHARED_STATE_SCHEMA_VERSION,
    workspaceId: params.workspace.workspaceId,
    workspaceCode: params.workspace.workspaceCode,
    workspaceName: params.workspace.workspaceName,
    savedAt,
    savedBy: params.savedBy ?? params.metadata.savedBy ?? 'unknown',
    revision,
    deviceId,
    taskOverlays: params.taskOverlays,
    viewPreference: loadViewPreference(),
    lastSyncedAt: params.lastSyncedAt ?? null,
    lastSharedStateSavedAt: savedAt,
  };
};

export const backupCurrentLocalStateBeforeSharedRead = (params: {
  appVersion: string;
  workspace: Workspace;
  lastSyncedAt: string | null;
  taskOverlays: TaskOverlay[];
}): { warning?: string; backupAt: string } => {
  const backup = createBackupPackage({
    appVersion: params.appVersion,
    workspace: params.workspace,
    projects: params.workspace.projects,
    workflowTemplates: WORKFLOW_TEMPLATES,
    taskOverlays: params.taskOverlays,
    viewPreference: loadViewPreference(),
    lastSyncedAt: params.lastSyncedAt,
  });

  const result = saveToStorage(SHARED_READ_SNAPSHOT_KEY, backup);
  return { warning: result.warning, backupAt: backup.exportedAt };
};

export const backupCurrentLocalStateBeforeSharedSave = (params: {
  taskOverlays: TaskOverlay[];
  metadata: SharedStateMetadata;
}): { warning?: string; savedAt: string } => {
  const savedAt = new Date().toISOString();
  const snapshot = {
    savedAt,
    reason: 'before-shared-save',
    taskOverlays: params.taskOverlays,
    sharedStateMetadata: params.metadata,
    viewPreference: loadViewPreference(),
  };

  const result = saveToStorage(SHARED_SAVE_SNAPSHOT_KEY, snapshot);
  return { warning: result.warning, savedAt };
};

export const applySharedStatePackage = (sharedState: SharedStatePackage): { ok: boolean; warning?: string } => {
  const overlayResult = replaceAllTaskOverlays(sharedState.taskOverlays as TaskOverlay[]);
  if (overlayResult.warning) {
    return { ok: false, warning: overlayResult.warning };
  }

  const viewResult = saveViewPreference(sharedState.viewPreference ?? {});
  if (viewResult.warning) {
    return { ok: false, warning: viewResult.warning };
  }

  return { ok: true };
};
