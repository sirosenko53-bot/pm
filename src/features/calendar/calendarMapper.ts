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
  const project = workspace.projects.find((item) => item.projectName === parsed.projectName);

  const startDateTime = resolveDateValue(event.start);
  const endDateTime = resolveDateValue(event.end);

  return {
    taskId: `${calendarSource.calendarId}:${event.id}`,
    googleCalendarEventId: event.id,
    calendarId: calendarSource.calendarId,
    titleRaw: event.summary ?? '',
    assignee: parsed.assignee,
    taskName: parsed.taskName,
    projectName: parsed.projectName,
    projectId: project?.projectId ?? 'unclassified',
    stageId: project ? estimateStageId(project.projectType, parsed.taskName) : undefined,
    startDateTime,
    endDateTime: endDateTime || undefined,
    dueDate: endDateTime || startDateTime || undefined,
    parseError: parsed.parseError,
  };
};
