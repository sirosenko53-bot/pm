import type { TaskViewModel } from '../../domain/taskTypes';

export type TitleCorrectionPreview = {
  taskId: string;
  googleCalendarEventId: string;
  calendarId: string;
  reason: string;
  titleRaw: string;
  proposedTitle: string;
  assignee: string;
  taskName: string;
  projectName: string;
};

export type PostponePreview = {
  taskId: string;
  googleCalendarEventId: string;
  calendarId: string;
  taskName: string;
  titleRaw: string;
  currentStartDateTime: string;
  currentEndDateTime?: string;
  currentDueDate?: string;
  postponeDays: number;
  proposedStartDateTime: string;
  proposedEndDateTime?: string;
  proposedDueDate?: string;
  planSource: string;
};

const clampText = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const toDateTime = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDaysToDateTime = (value: string | undefined, days: number): string | undefined => {
  const date = toDateTime(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const getDelayDays = (task: TaskViewModel, today = new Date()): number => {
  const dueDate = toDateTime(task.dueDate ?? task.endDateTime ?? task.startDateTime);
  if (!dueDate) return 1;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  const diffDays = Math.ceil((todayStart - dueStart) / 86_400_000);
  return Math.max(1, diffDays + 1);
};

export const toCanonicalCalendarTitle = (task: TaskViewModel): string => {
  const assignee = clampText(task.assignee === '未設定' ? undefined : task.assignee, '未設定');
  const taskName = clampText(task.taskName, clampText(task.titleRaw, '(タイトルなし)'));
  const projectName = clampText(task.projectName === '未分類' ? undefined : task.projectName, '未分類');
  return `${assignee} / ${taskName} / ${projectName}`;
};

export const buildTitleCorrectionPreviews = (tasks: TaskViewModel[]): TitleCorrectionPreview[] =>
  tasks
    .filter((task) => task.parseError || task.isUnclassifiedProject)
    .map((task) => ({
      taskId: task.taskId,
      googleCalendarEventId: task.googleCalendarEventId,
      calendarId: task.calendarId,
      reason: task.parseError ?? 'プロジェクトを特定できませんでした',
      titleRaw: task.titleRaw,
      proposedTitle: toCanonicalCalendarTitle(task),
      assignee: task.assignee,
      taskName: task.taskName,
      projectName: task.projectName,
    }));

export const resolvePostponeDays = (input: string, task: TaskViewModel, today = new Date()): number => {
  const normalized = input.trim();
  const explicitDays = normalized.match(/(\d+)\s*日/);
  if (explicitDays) return Math.max(1, Number(explicitDays[1]));
  if (normalized.includes('明後日')) return 2;
  if (normalized.includes('明日')) return 1;
  if (normalized.includes('来週')) return 7;
  return getDelayDays(task, today);
};

export const buildPostponePreviews = (
  tasks: TaskViewModel[],
  naturalLanguagePlan: string,
  today = new Date(),
): PostponePreview[] =>
  tasks
    .filter((task) => task.isDelayed && task.status !== '完了')
    .map((task) => {
      const postponeDays = resolvePostponeDays(naturalLanguagePlan, task, today);
      return {
        taskId: task.taskId,
        googleCalendarEventId: task.googleCalendarEventId,
        calendarId: task.calendarId,
        taskName: task.taskName,
        titleRaw: task.titleRaw,
        currentStartDateTime: task.startDateTime,
        currentEndDateTime: task.endDateTime,
        currentDueDate: task.dueDate,
        postponeDays,
        proposedStartDateTime: addDaysToDateTime(task.startDateTime, postponeDays) ?? task.startDateTime,
        proposedEndDateTime: addDaysToDateTime(task.endDateTime, postponeDays),
        proposedDueDate: addDaysToDateTime(task.dueDate, postponeDays),
        planSource: naturalLanguagePlan.trim() || '遅延日数から自動計算',
      };
    });
