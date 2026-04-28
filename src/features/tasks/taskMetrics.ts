import type { TaskStatus, TaskViewModel } from '../../domain/taskTypes';

const isSameDate = (dateString: string | undefined, target: Date) => {
  if (!dateString) return false;
  const value = new Date(dateString);
  return (
    value.getFullYear() === target.getFullYear() &&
    value.getMonth() === target.getMonth() &&
    value.getDate() === target.getDate()
  );
};

export type TaskSummary = {
  total: number;
  today: number;
  delayed: number;
  reviewWaiting: number;
  revisionWaiting: number;
  parseError: number;
  unclassified: number;
  statusCounts: Record<TaskStatus, number>;
};

export const calculateTaskSummary = (tasks: TaskViewModel[]): TaskSummary => {
  const today = new Date();
  const statusCounts: Record<TaskStatus, number> = {
    未着手: 0,
    進行中: 0,
    確認待ち: 0,
    修正待ち: 0,
    完了: 0,
  };

  tasks.forEach((task) => {
    statusCounts[task.status] += 1;
  });

  return {
    total: tasks.length,
    today: tasks.filter((task) => isSameDate(task.startDateTime, today) || isSameDate(task.dueDate, today)).length,
    delayed: tasks.filter((task) => task.isDelayed).length,
    reviewWaiting: tasks.filter((task) => task.status === '確認待ち').length,
    revisionWaiting: tasks.filter((task) => task.status === '修正待ち').length,
    parseError: tasks.filter((task) => task.parseError).length,
    unclassified: tasks.filter((task) => task.isUnclassifiedProject).length,
    statusCounts,
  };
};

export const filterTasksByProject = (tasks: TaskViewModel[], projectId: string) =>
  tasks.filter((task) => task.projectId === projectId);
