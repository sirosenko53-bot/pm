import type { TaskViewModel } from '../../domain/taskTypes';

const parseDateTime = (value?: string): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

const isSameDate = (value: string | undefined, today: Date): boolean => {
  if (!value) return false;
  const date = new Date(value);
  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
};

export const sortReviewFixTasks = (tasks: TaskViewModel[]): TaskViewModel[] =>
  [...tasks].sort((a, b) => {
    if (a.isDelayed !== b.isDelayed) {
      return a.isDelayed ? -1 : 1;
    }

    const dueDiff = parseDateTime(a.dueDate) - parseDateTime(b.dueDate);
    if (dueDiff !== 0) return dueDiff;

    const startDiff = parseDateTime(a.startDateTime) - parseDateTime(b.startDateTime);
    if (startDiff !== 0) return startDiff;

    const projectDiff = a.projectName.localeCompare(b.projectName, 'ja');
    if (projectDiff !== 0) return projectDiff;

    return a.taskName.localeCompare(b.taskName, 'ja');
  });

export const getReviewWaitingTasks = (tasks: TaskViewModel[]): TaskViewModel[] =>
  sortReviewFixTasks(tasks.filter((task) => task.status === '確認待ち'));

export const getFixWaitingTasks = (tasks: TaskViewModel[]): TaskViewModel[] =>
  sortReviewFixTasks(tasks.filter((task) => task.status === '修正待ち'));

export const getTodayReviewFixTasks = (tasks: TaskViewModel[], today: Date): TaskViewModel[] =>
  sortReviewFixTasks(
    tasks.filter(
      (task) => task.isDelayed || isSameDate(task.dueDate, today) || isSameDate(task.startDateTime, today),
    ),
  );

export const groupReviewFixByAssignee = (tasks: TaskViewModel[]): Array<{ assignee: string; count: number }> => {
  const counts = new Map<string, number>();
  tasks.forEach((task) => {
    counts.set(task.assignee, (counts.get(task.assignee) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([assignee, count]) => ({ assignee, count }))
    .sort((a, b) => b.count - a.count || a.assignee.localeCompare(b.assignee, 'ja'));
};

export const groupReviewFixByStage = (tasks: TaskViewModel[]): Array<{ stageName: string; count: number }> => {
  const counts = new Map<string, number>();
  tasks.forEach((task) => {
    const stageName = task.stageName ?? '未設定工程';
    counts.set(stageName, (counts.get(stageName) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([stageName, count]) => ({ stageName, count }))
    .sort((a, b) => b.count - a.count || a.stageName.localeCompare(b.stageName, 'ja'));
};

export const calculateReviewFixSummary = (tasks: TaskViewModel[], today: Date) => {
  const reviewWaiting = getReviewWaitingTasks(tasks);
  const fixWaiting = getFixWaitingTasks(tasks);
  const allReviewFix = sortReviewFixTasks([...reviewWaiting, ...fixWaiting]);
  const delayedCount = allReviewFix.filter((task) => task.isDelayed).length;
  const todayCount = getTodayReviewFixTasks(allReviewFix, today).length;

  return {
    reviewWaiting,
    fixWaiting,
    allReviewFix,
    delayedCount,
    todayCount,
    assigneeGroups: groupReviewFixByAssignee(allReviewFix),
    stageGroups: groupReviewFixByStage(allReviewFix),
  };
};
