import type { Task } from '../../domain/taskTypes';
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

const isTask = (value: unknown): value is Task => {
  if (!value || typeof value !== 'object') return false;

  const task = value as Partial<Task>;
  return (
    typeof task.taskId === 'string' &&
    typeof task.googleCalendarEventId === 'string' &&
    typeof task.calendarId === 'string' &&
    typeof task.titleRaw === 'string' &&
    typeof task.assignee === 'string' &&
    typeof task.taskName === 'string' &&
    typeof task.projectName === 'string' &&
    typeof task.projectId === 'string' &&
    typeof task.startDateTime === 'string'
  );
};

const isCalendarTaskCache = (value: unknown): value is CalendarTaskCache => {
  if (!value || typeof value !== 'object') return false;

  const cache = value as Partial<CalendarTaskCache>;
  return (
    typeof cache.workspaceId === 'string' &&
    Array.isArray(cache.tasks) &&
    cache.tasks.every(isTask) &&
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

  return { value: result.value };
};

export const saveCalendarTaskCache = (cache: CalendarTaskCache): { ok: boolean; warning?: string } =>
  saveToStorage(STORAGE_KEY, cache);
