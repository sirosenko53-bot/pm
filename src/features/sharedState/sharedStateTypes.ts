import type { TaskOverlay } from '../../domain/taskTypes';
import type { ViewPreference } from '../backup/backupTypes';

export const SHARED_STATE_SCHEMA_VERSION = '1.0' as const;

export type SharedStateSource = 'local' | 'shared-json' | 'shared-json-read-failed';

export type SharedStateSyncStatus = 'idle' | 'loading' | 'loaded' | 'saving' | 'saved' | 'failed' | 'conflict';

export type SharedOverlaySource = 'manual' | 'shared-json' | 'backup-restore' | 'system';

export type SharedTaskOverlay = TaskOverlay & {
  updatedBy?: string;
  source?: SharedOverlaySource;
};

export type SharedStatePackage = {
  app: 'seisaku-pm';
  sharedStateSchemaVersion: typeof SHARED_STATE_SCHEMA_VERSION;
  workspaceId: string;
  workspaceCode: string;
  workspaceName: string;
  savedAt: string;
  savedBy: string;
  revision: number;
  deviceId: string;
  taskOverlays: SharedTaskOverlay[];
  viewPreference: ViewPreference;
  lastSyncedAt: string | null;
  lastSharedStateSavedAt: string | null;
};

export type SharedStateMetadata = {
  source: SharedStateSource;
  syncStatus: SharedStateSyncStatus;
  sharedFileName: string | null;
  sharedFileId: string | null;
  revision: number;
  loadedRevision: number;
  savedAt: string | null;
  savedBy: string | null;
  deviceId: string | null;
  lastReadAt: string | null;
  lastSaveAt: string | null;
  hasLocalChangesAfterShare: boolean;
  lastReadError: string | null;
  autoReadSharedStateOnEnter: boolean;
};

export const DEFAULT_SHARED_STATE_FILE_NAME = 'shared-state.json';

export const createInitialSharedStateMetadata = (): SharedStateMetadata => ({
  source: 'local',
  syncStatus: 'idle',
  sharedFileName: null,
  sharedFileId: null,
  revision: 0,
  loadedRevision: 0,
  savedAt: null,
  savedBy: null,
  deviceId: null,
  lastReadAt: null,
  lastSaveAt: null,
  hasLocalChangesAfterShare: false,
  lastReadError: null,
  autoReadSharedStateOnEnter: false,
});

export type SharedStateValidationResult = {
  ok: boolean;
  errors: string[];
};
