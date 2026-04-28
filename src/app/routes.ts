export type AppRoute =
  | { name: 'workspace-code' }
  | { name: 'workspace-home' }
  | { name: 'project-overview'; projectId: string }
  | { name: 'task-board'; projectId?: string; fromProjectId?: string }
  | { name: 'today'; projectId: string }
  | { name: 'workflow'; projectId: string }
  | { name: 'review-fix'; projectId: string }
  | { name: 'backup-settings'; projectId?: string };
