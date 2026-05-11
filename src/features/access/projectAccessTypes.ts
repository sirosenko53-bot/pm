export type ProjectAccessMode = 'project' | 'admin';

export type ProjectAccessCode = {
  code: string;
  label: string;
  projectIds: string[];
  defaultProjectId?: string;
  mode: ProjectAccessMode;
};

export type JoinedProject = {
  projectId: string;
  joinedAt: string;
  lastOpenedAt?: string;
};

export type LastViewRoute =
  | 'joined-projects'
  | 'workspace-home'
  | 'project-overview'
  | 'today'
  | 'workflow'
  | 'task-board'
  | 'review-fix'
  | 'backup-settings';

export type LastView = {
  route: LastViewRoute;
  projectId?: string;
  updatedAt: string;
};
