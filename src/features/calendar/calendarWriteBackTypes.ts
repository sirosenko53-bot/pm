import type { GoogleCalendarEventPatch } from './googleCalendarClient';

export type CalendarWriteBackReason = 'title-normalize' | 'postpone';

export type CalendarWriteBackDraft = {
  draftId: string;
  taskId: string;
  calendarId: string;
  googleCalendarEventId: string;
  taskName: string;
  projectName: string;
  reason: CalendarWriteBackReason;
  previousSummary: string;
  nextSummary?: string;
  previousStart?: string;
  nextStart?: string;
  previousEnd?: string;
  nextEnd?: string;
  patch: GoogleCalendarEventPatch;
};

export type CalendarWriteBackBackup = {
  app: 'seisaku-pm';
  backupType: 'calendar-writeback-preview';
  exportedAt: string;
  drafts: CalendarWriteBackDraft[];
};
