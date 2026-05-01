import { estimateStageId } from '../../config/workflowTemplates';
import type { Task } from '../../domain/taskTypes';
import type { CalendarSource, Workspace } from '../../domain/workspaceTypes';
import type { GoogleCalendarEvent } from './googleCalendarClient';
import { parseCalendarTitle } from './titleParser';

const resolveDateValue = (dateValue?: { dateTime?: string; date?: string }) => dateValue?.dateTime ?? dateValue?.date ?? '';

export const mapCalendarEventToTask = (
  event: GoogleCalendarEvent,
  calendarSource: CalendarSource,
  workspace: Workspace,
): Task => {
  const parsed = parseCalendarTitle(event.summary ?? '');
  const projectByTitle = workspace.projects.find((item) => item.projectName === parsed.projectName);
  const projectByCalendar = workspace.projects.find((item) => item.projectId === calendarSource.projectId);
  const project = projectByTitle ?? projectByCalendar;
  const parseError =
    parsed.parseError
    ?? (!projectByTitle && parsed.projectName !== '未分類'
      ? '予定名のプロジェクト名が設定と一致しないため、カレンダー設定のプロジェクトで分類しました'
      : undefined);

  const startDateTime = resolveDateValue(event.start);
  const endDateTime = resolveDateValue(event.end);

  return {
    taskId: `${calendarSource.calendarId}:${event.id}`,
    googleCalendarEventId: event.id,
    calendarId: calendarSource.calendarId,
    titleRaw: event.summary ?? '',
    assignee: parsed.assignee,
    taskName: parsed.taskName,
    projectName: project?.projectName ?? parsed.projectName,
    projectId: project?.projectId ?? 'unclassified',
    stageId: project ? estimateStageId(project.projectType, parsed.taskName) : undefined,
    startDateTime,
    endDateTime: endDateTime || undefined,
    dueDate: endDateTime || startDateTime || undefined,
    parseError,
  };
};
