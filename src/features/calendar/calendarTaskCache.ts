import { TASK_PRIORITIES, type Task, type TaskPriority } from '../../domain/taskTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';
import type { CalendarImportSummary } from './calendarDiagnostics';

const STORAGE_KEY = 'seisaku-pm:calendar-task-cache';

export type CalendarTaskCache = {
  workspaceId: string;
  tasks: Task[];
  calendarStatus: string;
  calendarImportSummary?: CalendarImportSummary;
  cachedAt: string;
};

const isString = (value: unknown): value is string => typeof value === 'string';

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === 'string' && TASK_PRIORITIES.includes(value as TaskPriority);

const normalizeCachedTask = (value: unknown): Task | null => {
  if (!value || typeof value !== 'object') return null;

  const task = value as Partial<Task>;
  if (
    !isString(task.taskId) ||
    !isString(task.googleCalendarEventId) ||
    !isString(task.calendarId) ||
    !isString(task.titleRaw) ||
    !isString(task.taskName) ||
    !isString(task.projectId) ||
    !isOptionalString(task.assignee) ||
    !isOptionalString(task.projectName) ||
    !isOptionalString(task.stageId) ||
    !isOptionalString(task.startDateTime) ||
    !isOptionalString(task.endDateTime) ||
    !isOptionalString(task.dueDate) ||
    !isOptionalString(task.parseError)
  ) {
    return null;
  }

  return {
    taskId: task.taskId,
    googleCalendarEventId: task.googleCalendarEventId,
    calendarId: task.calendarId,
    titleRaw: task.titleRaw,
    assignee: task.assignee ?? '未設定',
    taskName: task.taskName,
    priority: isTaskPriority(task.priority) ? task.priority : '中',
    projectName: task.projectName ?? '未分類',
    projectId: task.projectId,
    stageId: task.stageId,
    startDateTime: task.startDateTime ?? '',
    endDateTime: task.endDateTime,
    dueDate: task.dueDate,
    parseError: task.parseError,
  };
};

const isCalendarTaskCache = (value: unknown): value is CalendarTaskCache => {
  if (!value || typeof value !== 'object') return false;

  const cache = value as Partial<CalendarTaskCache>;
  return (
    typeof cache.workspaceId === 'string' &&
    Array.isArray(cache.tasks) &&
    typeof cache.calendarStatus === 'string' &&
    typeof cache.cachedAt === 'string'
  );
};

export const loadCalendarTaskCache = (
  workspaceId: string,
): { value?: CalendarTaskCache; warning?: string } => {
  const result = loadFromStorage<unknown>(STORAGE_KEY, undefined);
  if (result.warning) {
    return { warning: result.warning };
  }

  if (!isCalendarTaskCache(result.value)) {
    return {};
  }

  if (result.value.workspaceId !== workspaceId) {
    return {};
  }

  const tasks = result.value.tasks
    .map(normalizeCachedTask)
    .filter((task): task is Task => Boolean(task));
  const warning =
    tasks.length < result.value.tasks.length
      ? '前回取り込みの一部を読み込めませんでした。有効な予定だけ復元しています。'
      : undefined;

  return { value: { ...result.value, tasks }, warning };
};

export const saveCalendarTaskCache = (cache: CalendarTaskCache): { ok: boolean; warning?: string } =>
  saveToStorage(STORAGE_KEY, cache);
