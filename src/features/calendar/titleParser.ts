export type ParsedTitle = {
  assignee: string;
  taskName: string;
  projectName: string;
  parseError?: string;
};

export const parseCalendarTitle = (titleRaw: string): ParsedTitle => {
  const segments = titleRaw
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 3) {
    return { assignee: segments[0], taskName: segments[1], projectName: segments[2] };
  }

  return {
    assignee: '未設定',
    taskName: titleRaw.trim() || '(タイトルなし)',
    projectName: '未分類',
    parseError: '予定名を「担当者 / タスク名 / プロジェクト」で解析できませんでした',
  };
};
