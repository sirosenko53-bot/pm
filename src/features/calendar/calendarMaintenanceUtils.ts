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

const startOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseJapaneseNumber = (value: string): number | undefined => {
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);

  const digitMap: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (normalized === '十') return 10;
  const tenIndex = normalized.indexOf('十');
  if (tenIndex >= 0) {
    const before = normalized.slice(0, tenIndex);
    const after = normalized.slice(tenIndex + 1);
    const tens = before ? digitMap[before] : 1;
    const ones = after ? digitMap[after] : 0;
    return tens !== undefined && ones !== undefined ? tens * 10 + ones : undefined;
  }

  return digitMap[normalized];
};

const getNextWeekdayDate = (baseDate: Date, targetDay: number, forceNextWeek = false): Date => {
  const base = startOfLocalDay(baseDate);
  const currentDay = base.getDay();
  let diff = (targetDay - currentDay + 7) % 7;
  if (diff === 0 || forceNextWeek) diff += 7;
  return addDays(base, diff);
};

const getEndOfMonthDate = (baseDate: Date): Date => {
  const base = startOfLocalDay(baseDate);
  const endOfThisMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  if (endOfThisMonth.getTime() > base.getTime()) return endOfThisMonth;
  return new Date(base.getFullYear(), base.getMonth() + 2, 0);
};

const parseAbsoluteDate = (input: string, baseDate: Date): Date | undefined => {
  const isoMatch = input.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const monthDayMatch = input.match(/(\d{1,2})\s*[月/]\s*(\d{1,2})\s*日?/);
  if (!monthDayMatch) return undefined;

  const [, month, day] = monthDayMatch;
  const base = startOfLocalDay(baseDate);
  const candidate = new Date(base.getFullYear(), Number(month) - 1, Number(day));
  if (candidate.getTime() <= base.getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
};

const parseWeekdayDate = (input: string, baseDate: Date): Date | undefined => {
  const weekdayMap: Record<string, number> = {
    日曜: 0,
    日曜日: 0,
    月曜: 1,
    月曜日: 1,
    火曜: 2,
    火曜日: 2,
    水曜: 3,
    水曜日: 3,
    木曜: 4,
    木曜日: 4,
    金曜: 5,
    金曜日: 5,
    土曜: 6,
    土曜日: 6,
  };

  const match = input.match(/(来週|次の|今週)?\s*(日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日曜|月曜|火曜|水曜|木曜|金曜|土曜)/);
  if (!match) return undefined;
  const [, modifier, weekday] = match;
  const targetDay = weekdayMap[weekday];
  if (targetDay === undefined) return undefined;
  return getNextWeekdayDate(baseDate, targetDay, modifier === '来週');
};

const resolveTargetDateFromInstruction = (
  input: string,
  baseDate: Date,
): { days: number; targetDate: string } | undefined => {
  const base = startOfLocalDay(baseDate);
  const compact = input.replace(/\s+/g, '');

  const absoluteDate = parseAbsoluteDate(compact, base);
  if (absoluteDate) {
    const days = Math.round((startOfLocalDay(absoluteDate).getTime() - base.getTime()) / MS_PER_DAY);
    return days > 0 ? { days, targetDate: formatInputDate(absoluteDate) } : undefined;
  }

  const weekdayDate = parseWeekdayDate(compact, base);
  if (weekdayDate) {
    const days = Math.round((startOfLocalDay(weekdayDate).getTime() - base.getTime()) / MS_PER_DAY);
    return days > 0 ? { days, targetDate: formatInputDate(weekdayDate) } : undefined;
  }

  if (/月末/.test(compact)) {
    const target = getEndOfMonthDate(base);
    const days = Math.round((target.getTime() - base.getTime()) / MS_PER_DAY);
    return days > 0 ? { days, targetDate: formatInputDate(target) } : undefined;
  }

  if (/週明け/.test(compact)) {
    const target = getNextWeekdayDate(base, 1);
    const days = Math.round((target.getTime() - base.getTime()) / MS_PER_DAY);
    return { days, targetDate: formatInputDate(target) };
  }

  if (/週末/.test(compact)) {
    const target = getNextWeekdayDate(base, 6);
    const days = Math.round((target.getTime() - base.getTime()) / MS_PER_DAY);
    return { days, targetDate: formatInputDate(target) };
  }

  if (/明後日/.test(compact)) return { days: 2, targetDate: formatInputDate(addDays(base, 2)) };
  if (/明日/.test(compact)) return { days: 1, targetDate: formatInputDate(addDays(base, 1)) };
  if (/再来週/.test(compact)) return { days: 14, targetDate: formatInputDate(addDays(base, 14)) };
  if (/来週|次週/.test(compact)) return { days: 7, targetDate: formatInputDate(addDays(base, 7)) };
  if (/半月/.test(compact)) return { days: 14, targetDate: formatInputDate(addDays(base, 14)) };

  const weekMatch = compact.match(/(\d+|[一二三四五六七八九十]+)週間?/);
  if (weekMatch) {
    const weeks = parseJapaneseNumber(weekMatch[1]);
    if (weeks && weeks > 0) {
      const days = weeks * 7;
      return { days, targetDate: formatInputDate(addDays(base, days)) };
    }
  }

  const dayMatch = compact.match(/(\d+|[一二三四五六七八九十]+)日(?:後|先|延ばす|延ばし|延期|送る|にする)?/);
  if (dayMatch) {
    const days = parseJapaneseNumber(dayMatch[1]);
    if (days && days > 0) {
      return { days, targetDate: formatInputDate(addDays(base, days)) };
    }
  }

  return undefined;
};

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

  const baseDate = resolveBaseDate(task);
  const resolved = resolveTargetDateFromInstruction(trimmed, baseDate);
  if (!resolved) {
    return {
      ok: false,
      error: '日数や日付を読み取れませんでした。「3日後」「二週間後」「来週月曜」「5/10」「月末」などで入力してください。',
    };
  }

  return {
    ok: true,
    days: resolved.days,
    targetDate: resolved.targetDate,
    message: `現在の期限を基準に ${resolved.days}日 先へ送る案を作りました。`,
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
