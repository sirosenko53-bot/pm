import type { TaskViewModel } from '../../domain/taskTypes';
import type { Project } from '../../domain/workspaceTypes';
import type { CalendarWriteBackBackup, CalendarWriteBackDraft } from './calendarWriteBackTypes';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getDateValue = (value?: string): string | undefined => (value && value.trim() ? value : undefined);

const formatInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveBaseDate = (task: TaskViewModel): Date => {
  const source = task.dueDate ?? task.endDateTime ?? task.startDateTime;
  const parsed = source ? new Date(source) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const shiftDatePreservingTime = (value: string | undefined, targetDate: string): string | undefined => {
  if (!value) return undefined;
  const current = new Date(value);
  if (Number.isNaN(current.getTime())) return undefined;

  if (!value.includes('T')) {
    return targetDate;
  }

  const [year, month, day] = targetDate.split('-').map(Number);
  const next = new Date(current);
  next.setFullYear(year, month - 1, day);
  return next.toISOString();
};

const buildCalendarDatePatch = (previousValue: string | undefined, nextValue: string | undefined) => {
  if (!nextValue) return undefined;
  return previousValue?.includes('T') ? { dateTime: nextValue } : { date: nextValue };
};

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * MS_PER_DAY);

export const buildNormalizedTitle = (task: TaskViewModel, project?: Project): string => {
  const assignee = task.assignee?.trim() || '未設定';
  const taskName = task.taskName?.trim() || task.titleRaw.trim() || 'タイトルなし';
  const projectName = project?.projectName ?? task.projectName?.trim() ?? '未分類';
  return `${assignee} / ${taskName} / ${projectName}`;
};

export const createTitleNormalizeDraft = (task: TaskViewModel, project?: Project): CalendarWriteBackDraft => {
  const nextSummary = buildNormalizedTitle(task, project);
  return {
    draftId: `title:${task.taskId}`,
    taskId: task.taskId,
    calendarId: task.calendarId,
    googleCalendarEventId: task.googleCalendarEventId,
    taskName: task.taskName,
    projectName: project?.projectName ?? task.projectName,
    reason: 'title-normalize',
    previousSummary: task.titleRaw,
    nextSummary,
    previousStart: getDateValue(task.startDateTime),
    previousEnd: getDateValue(task.endDateTime),
    patch: { summary: nextSummary },
  };
};

export const parsePostponeInstruction = (
  input: string,
  task: TaskViewModel,
): { ok: true; days: number; targetDate: string; message: string } | { ok: false; error: string } => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: '先送り日数の方針を入力してください。例: 3日後にする' };
  }

  const directDays = trimmed.match(/(\d+)\s*日/);
  const week = /1週間|一週間|来週/.test(trimmed) ? 7 : null;
  const tomorrow = /明日/.test(trimmed) ? 1 : null;
  const dayAfterTomorrow = /明後日/.test(trimmed) ? 2 : null;

  const days = directDays ? Number(directDays[1]) : week ?? dayAfterTomorrow ?? tomorrow;
  if (!days || days < 1) {
    return { ok: false, error: '日数を読み取れませんでした。「3日後」「1週間」などで入力してください。' };
  }

  const baseDate = resolveBaseDate(task);
  const targetDate = formatInputDate(addDays(baseDate, days));
  return {
    ok: true,
    days,
    targetDate,
    message: `現在の期限を基準に ${days}日 先へ送る案を作りました。`,
  };
};

export const createPostponeDraft = (
  task: TaskViewModel,
  targetDate: string,
): { ok: true; draft: CalendarWriteBackDraft } | { ok: false; error: string } => {
  if (!targetDate) {
    return { ok: false, error: '先送り日を指定してください。' };
  }

  const nextStart = shiftDatePreservingTime(task.startDateTime, targetDate);
  const nextEnd = shiftDatePreservingTime(task.endDateTime ?? task.dueDate, targetDate);

  if (!nextStart && !nextEnd) {
    return { ok: false, error: '予定の開始日または終了日を読み取れないため、先送り案を作成できません。' };
  }

  return {
    ok: true,
    draft: {
      draftId: `postpone:${task.taskId}:${targetDate}`,
      taskId: task.taskId,
      calendarId: task.calendarId,
      googleCalendarEventId: task.googleCalendarEventId,
      taskName: task.taskName,
      projectName: task.projectName,
      reason: 'postpone',
      previousSummary: task.titleRaw,
      previousStart: getDateValue(task.startDateTime),
      nextStart,
      previousEnd: getDateValue(task.endDateTime ?? task.dueDate),
      nextEnd,
      patch: {
        start: buildCalendarDatePatch(task.startDateTime, nextStart),
        end: buildCalendarDatePatch(task.endDateTime ?? task.dueDate, nextEnd),
      },
    },
  };
};

export const exportCalendarWriteBackBackup = (drafts: CalendarWriteBackDraft[]): void => {
  const backup: CalendarWriteBackBackup = {
    app: 'seisaku-pm',
    backupType: 'calendar-writeback-preview',
    exportedAt: new Date().toISOString(),
    drafts,
  };
  const timestamp = backup.exportedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `seisaku-pm-calendar-writeback-${timestamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
