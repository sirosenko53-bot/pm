import { TASK_STATUSES, type TaskOverlay } from '../../domain/taskTypes';
import type { Project, Workspace } from '../../domain/workspaceTypes';
import type { WorkflowTemplate } from '../../domain/workflowTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';
import { replaceAllTaskOverlays } from '../tasks/taskOverlayStore';
import type { BackupPackage, RestoreResult, ViewPreference } from './backupTypes';

const LAST_BACKUP_AT_KEY = 'seisaku-pm:last-backup-at';
const VIEW_PREFERENCE_KEY = 'seisaku-pm:view-preference';

type BackupCreateParams = {
  appVersion: string;
  workspace: Workspace;
  projects: Project[];
  workflowTemplates: WorkflowTemplate[];
  taskOverlays: TaskOverlay[];
  viewPreference: ViewPreference;
  lastSyncedAt: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTaskStatus = (value: unknown): value is (typeof TASK_STATUSES)[number] =>
  typeof value === 'string' && TASK_STATUSES.includes(value as (typeof TASK_STATUSES)[number]);

export const loadViewPreference = (): ViewPreference =>
  loadFromStorage<ViewPreference>(VIEW_PREFERENCE_KEY, {}).value;

export const saveViewPreference = (viewPreference: ViewPreference): { warning?: string } => {
  const result = saveToStorage(VIEW_PREFERENCE_KEY, {
    ...viewPreference,
    updatedAt: new Date().toISOString(),
  });
  return { warning: result.warning };
};

export const loadLastBackupAt = (): string | null =>
  loadFromStorage<string | null>(LAST_BACKUP_AT_KEY, null).value;

export const saveLastBackupAt = (isoString: string): { warning?: string } => {
  const result = saveToStorage(LAST_BACKUP_AT_KEY, isoString);
  return { warning: result.warning };
};

export const createBackupPackage = ({
  appVersion,
  workspace,
  projects,
  workflowTemplates,
  taskOverlays,
  viewPreference,
  lastSyncedAt,
}: BackupCreateParams): BackupPackage => ({
  app: 'seisaku-pm',
  backupSchemaVersion: '1.0',
  appVersion,
  exportedAt: new Date().toISOString(),
  workspace: {
    workspaceId: workspace.workspaceId,
    workspaceCode: workspace.workspaceCode,
    workspaceName: workspace.workspaceName,
  },
  projects,
  workflowTemplates,
  taskOverlays,
  viewPreference,
  lastSyncedAt,
});

export const exportBackupToFile = (backup: BackupPackage): void => {
  const timestamp = backup.exportedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const fileName = `seisaku-pm-backup-${timestamp}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const parseBackupJson = (text: string): { ok: true; data: BackupPackage } | { ok: false; error: string } => {
  try {
    return { ok: true, data: JSON.parse(text) as BackupPackage };
  } catch {
    return { ok: false, error: 'JSONの解析に失敗しました。正しいファイルを選択してください。' };
  }
};

export const validateBackupPackage = (data: unknown): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!isRecord(data)) {
    return { ok: false, errors: ['JSONのルートがオブジェクトではありません。'] };
  }

  if (data.app !== 'seisaku-pm') {
    errors.push('app が seisaku-pm ではありません。');
  }

  if (typeof data.backupSchemaVersion !== 'string' || data.backupSchemaVersion.length === 0) {
    errors.push('backupSchemaVersion がありません。');
  }

  if (typeof data.exportedAt !== 'string' || data.exportedAt.length === 0) {
    errors.push('exportedAt がありません。');
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
      if (!isTaskStatus(overlay.status)) {
        errors.push(`taskOverlays[${index}].status が不正です。`);
      }
      if (overlay.sortOrder !== undefined && typeof overlay.sortOrder !== 'number') {
        errors.push(`taskOverlays[${index}].sortOrder は number である必要があります。`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
};

export const restoreBackupPackage = (backup: BackupPackage): RestoreResult => {
  const validation = validateBackupPackage(backup);
  if (!validation.ok) {
    return {
      ok: false,
      message: 'バックアップの検証に失敗したため復元を中止しました。',
      warning: validation.errors.join('\n'),
    };
  }

  const overlayResult = replaceAllTaskOverlays(backup.taskOverlays);
  if (overlayResult.warning) {
    return {
      ok: false,
      message: 'TaskOverlayの復元に失敗しました。',
      warning: overlayResult.warning,
    };
  }

  const viewPreferenceResult = saveViewPreference(backup.viewPreference ?? {});
  if (viewPreferenceResult.warning) {
    return {
      ok: false,
      message: '表示設定の復元に失敗しました。',
      warning: viewPreferenceResult.warning,
    };
  }

  const backupAtResult = saveLastBackupAt(new Date().toISOString());

  return {
    ok: true,
    message: `バックアップを上書き復元しました（${backup.taskOverlays.length}件）。`,
    warning: backupAtResult.warning,
    restoredOverlayCount: backup.taskOverlays.length,
  };
};
