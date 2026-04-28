import type { TaskOverlay } from '../../domain/taskTypes';
import type { WorkflowTemplate } from '../../domain/workflowTypes';
import type { Project, Workspace } from '../../domain/workspaceTypes';

export type ViewPreference = {
  taskBoardProjectFilter?: string;
  updatedAt?: string;
};

export type BackupPackage = {
  app: 'seisaku-pm';
  backupSchemaVersion: '1.0';
  appVersion: string;
  exportedAt: string;
  workspace: Pick<Workspace, 'workspaceId' | 'workspaceCode' | 'workspaceName'>;
  projects: Project[];
  workflowTemplates: WorkflowTemplate[];
  taskOverlays: TaskOverlay[];
  viewPreference: ViewPreference;
  lastSyncedAt: string | null;
};

export type RestoreResult = {
  ok: boolean;
  message: string;
  warning?: string;
  restoredOverlayCount?: number;
};
