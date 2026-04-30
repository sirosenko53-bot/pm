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
