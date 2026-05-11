import type { Workspace } from '../../domain/workspaceTypes';

const CALENDAR_SOURCE_SETTINGS_KEY = 'seisaku-pm:calendar-source-settings';

export type CalendarSourceSettings = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const normalizeCalendarIdInput = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const sourceFromEmbedUrl = url.searchParams.get('src');
    if (sourceFromEmbedUrl) return sourceFromEmbedUrl.trim();
  } catch {
    // Raw Google Calendar IDs are not URLs. Keep the raw trimmed value.
  }

  return trimmed;
};

export const loadCalendarSourceSettings = (): CalendarSourceSettings => {
  try {
    const raw = localStorage.getItem(CALENDAR_SOURCE_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return Object.entries(parsed).reduce<CalendarSourceSettings>((settings, [projectId, calendarId]) => {
      if (typeof calendarId !== 'string') return settings;
      const normalizedProjectId = projectId.trim();
      const normalizedCalendarId = normalizeCalendarIdInput(calendarId);
      if (!normalizedProjectId || !normalizedCalendarId) return settings;
      settings[normalizedProjectId] = normalizedCalendarId;
      return settings;
    }, {});
  } catch {
    return {};
  }
};

export const saveCalendarSourceSettings = (settings: CalendarSourceSettings) => {
  localStorage.setItem(CALENDAR_SOURCE_SETTINGS_KEY, JSON.stringify(settings));
};

export const saveCalendarIdForProject = (projectId: string, calendarId: string): CalendarSourceSettings => {
  const normalizedProjectId = projectId.trim();
  const normalizedCalendarId = normalizeCalendarIdInput(calendarId);
  const current = loadCalendarSourceSettings();

  if (!normalizedProjectId) return current;

  if (!normalizedCalendarId) {
    delete current[normalizedProjectId];
  } else {
    current[normalizedProjectId] = normalizedCalendarId;
  }

  saveCalendarSourceSettings(current);
  return current;
};

export const applyCalendarSourceSettings = (
  workspace: Workspace,
  settings: CalendarSourceSettings,
): Workspace => ({
  ...workspace,
  projects: workspace.projects.map((project) => {
    const calendarId = settings[project.projectId];
    return calendarId ? { ...project, calendarId } : project;
  }),
  calendarSources: workspace.calendarSources.map((source) => {
    const calendarId = settings[source.projectId];
    return calendarId ? { ...source, calendarId } : source;
  }),
});
