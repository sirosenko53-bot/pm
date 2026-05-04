import type { TaskPriority } from '../../domain/taskTypes';

export type ParsedTitle = {
  assignee: string;
  taskName: string;
  priority: TaskPriority;
  projectName: string;
  parseError?: string;
};

const DEFAULT_PRIORITY: TaskPriority = '中';
const PRIORITY_PATTERN = /(?:\(|（)\s*(高|中|低)\s*(?:\)|）)\s*$/;

const parseTaskNameAndPriority = (taskSegment: string): { taskName: string; priority: TaskPriority } => {
  const match = taskSegment.match(PRIORITY_PATTERN);
  if (!match) {
    return { taskName: taskSegment.trim(), priority: DEFAULT_PRIORITY };
  }

  const priority = match[1] as TaskPriority;
  const taskName = taskSegment.slice(0, match.index).trim();
  return { taskName: taskName || taskSegment.trim(), priority };
};

export const parseCalendarTitle = (titleRaw: string): ParsedTitle => {
  const segments = titleRaw
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 3) {
    const parsedTask = parseTaskNameAndPriority(segments[1]);
    return {
      assignee: segments[0],
      taskName: parsedTask.taskName,
      priority: parsedTask.priority,
      projectName: segments[2],
    };
  }

  return {
    assignee: '未設定',
    taskName: titleRaw.trim() || '(タイトルなし)',
    priority: DEFAULT_PRIORITY,
    projectName: '未分類',
    parseError: '予定名を「担当者 / タスク名（高・中・低） / プロジェクト」で解析できませんでした',
  };
};
