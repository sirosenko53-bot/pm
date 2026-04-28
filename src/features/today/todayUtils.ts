import type { TaskViewModel } from '../../domain/taskTypes';

const toDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const isSameDate = (dateA: Date | null, dateB: Date | null) => {
  if (!dateA || !dateB) return false;
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

export const isTodayTask = (task: TaskViewModel, today: Date) => {
  const start = toDate(task.startDateTime);
  const end = toDate(task.endDateTime);
  const due = toDate(task.dueDate);
  return isSameDate(start, today) || isSameDate(end, today) || isSameDate(due, today);
};

export const isDueToday = (task: TaskViewModel, today: Date) => {
  const due = toDate(task.dueDate);
  return isSameDate(due, today);
};

export const sortTodayTasks = (tasks: TaskViewModel[]) => {
  return [...tasks].sort((a, b) => {
    const startA = toDate(a.startDateTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const startB = toDate(b.startDateTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (startA !== startB) return startA - startB;

    const dueA = toDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const dueB = toDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (dueA !== dueB) return dueA - dueB;

    return a.taskName.localeCompare(b.taskName, 'ja');
  });
};

export const formatTaskTime = (task: TaskViewModel) => {
  const start = toDate(task.startDateTime);
  if (start) {
    return start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }
  const due = toDate(task.dueDate);
  if (due) {
    return due.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }
  return '--:--';
};
