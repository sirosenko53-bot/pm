export const TASK_STATUSES = ['未着手', '進行中', '確認待ち', '修正待ち', '完了'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['高', '中', '低', '後回し'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Task = {
  taskId: string;
  googleCalendarEventId: string;
  calendarId: string;
  titleRaw: string;
  assignee: string;
  taskName: string;
  projectName: string;
  projectId: string;
  stageId?: string;
  startDateTime: string;
  endDateTime?: string;
  dueDate?: string;
  parseError?: string;
};

export type TaskOverlay = {
  taskId: string;
  googleCalendarEventId: string;
  status: TaskStatus;
  stageOverride?: string;
  priority?: TaskPriority;
  reviewer?: string;
  memo?: string;
  sortOrder?: number;
  updatedAt: string;
};

export type TaskViewModel = Task & {
  stageName?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  reviewer?: string;
  memo?: string;
  sortOrder?: number;
  isDelayed: boolean;
  isUnclassifiedProject?: boolean;
  overlayUpdatedAt?: string;
};
