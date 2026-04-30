import type { Project } from '../../domain/workspaceTypes';
import type { JoinedProject, LastView, LastViewRoute, ProjectAccessMode } from './projectAccessTypes';
import { resolveProjectAccessCode } from './projectAccessCodes';

const JOINED_PROJECTS_KEY = 'seisaku-pm:joined-projects';
const ACCESS_MODE_KEY = 'seisaku-pm:project-access-mode';
const LAST_VIEW_KEY = 'seisaku-pm:last-view';

const LAST_VIEW_ROUTES = new Set<LastViewRoute>([
  'joined-projects',
  'workspace-home',
  'project-overview',
  'today',
  'workflow',
  'task-board',
  'review-fix',
  'backup-settings',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeProjectId = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export const loadJoinedProjects = (): JoinedProject[] => {
  try {
    const raw = localStorage.getItem(JOINED_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed.reduce<JoinedProject[]>((items, item) => {
      if (!isRecord(item)) return items;
      const projectId = normalizeProjectId(item.projectId);
      if (!projectId || seen.has(projectId)) return items;
      seen.add(projectId);
      items.push({
        projectId,
        joinedAt: typeof item.joinedAt === 'string' ? item.joinedAt : new Date().toISOString(),
        lastOpenedAt: typeof item.lastOpenedAt === 'string' ? item.lastOpenedAt : undefined,
      });
      return items;
    }, []);
  } catch {
    return [];
  }
};

export const saveJoinedProjects = (joinedProjects: JoinedProject[]) => {
  localStorage.setItem(JOINED_PROJECTS_KEY, JSON.stringify(joinedProjects));
};

export const loadProjectAccessMode = (): ProjectAccessMode => {
  try {
    return localStorage.getItem(ACCESS_MODE_KEY) === 'admin' ? 'admin' : 'project';
  } catch {
    return 'project';
  }
};

export const saveProjectAccessMode = (mode: ProjectAccessMode) => {
  localStorage.setItem(ACCESS_MODE_KEY, mode);
};

export const isAdminAccess = (mode: ProjectAccessMode) => mode === 'admin';

export const addJoinedProjects = (projectIds: string[], mode: ProjectAccessMode): JoinedProject[] => {
  const now = new Date().toISOString();
  const current = loadJoinedProjects();
  const joinedMap = new Map(current.map((item) => [item.projectId, item]));

  projectIds.forEach((projectId) => {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) return;
    const existing = joinedMap.get(normalizedProjectId);
    joinedMap.set(normalizedProjectId, {
      projectId: normalizedProjectId,
      joinedAt: existing?.joinedAt ?? now,
      lastOpenedAt: now,
    });
  });

  const next = [...joinedMap.values()];
  saveJoinedProjects(next);
  saveProjectAccessMode(mode === 'admin' ? 'admin' : loadProjectAccessMode());
  return next;
};

export const addJoinedProjectsByAccessCode = (code: string): {
  ok: true;
  joinedProjects: JoinedProject[];
  accessMode: ProjectAccessMode;
  defaultProjectId?: string;
  label: string;
  addedProjectIds: string[];
  alreadyJoined: boolean;
} | { ok: false; error: string } => {
  const accessCode = resolveProjectAccessCode(code);
  if (!accessCode) {
    return { ok: false, error: '有効なプロジェクトコードではありません。' };
  }

  const currentMode = loadProjectAccessMode();
  const currentIds = new Set(loadJoinedProjects().map((item) => item.projectId));
  const nextMode = accessCode.mode === 'admin' ? 'admin' : currentMode;
  const addedProjectIds = accessCode.projectIds.filter((projectId) => !currentIds.has(projectId));
  const joinedProjects = addJoinedProjects(accessCode.projectIds, nextMode);
  return {
    ok: true,
    joinedProjects,
    accessMode: nextMode,
    defaultProjectId: accessCode.defaultProjectId,
    label: accessCode.label,
    addedProjectIds,
    alreadyJoined: addedProjectIds.length === 0,
  };
};

export const removeJoinedProject = (projectId: string): JoinedProject[] => {
  const next = loadJoinedProjects().filter((item) => item.projectId !== projectId);
  saveJoinedProjects(next);
  if (loadProjectAccessMode() === 'admin') {
    saveProjectAccessMode('project');
  }
  return next;
};

export const updateLastOpenedProject = (projectId: string): JoinedProject[] => {
  const now = new Date().toISOString();
  const next = loadJoinedProjects().map((item) =>
    item.projectId === projectId ? { ...item, lastOpenedAt: now } : item,
  );
  saveJoinedProjects(next);
  return next;
};

export const findProjectByAccessProjectId = (projects: Project[], projectId: string): Project | undefined =>
  projects.find((project) =>
    project.projectId === projectId
    || project.projectType === projectId
    || project.projectId === `project-${projectId}`,
  );

export const getAccessProjectId = (project: Project): string => project.projectType || project.projectId;

export const getVisibleProjects = (
  projects: Project[],
  joinedProjects: JoinedProject[],
  accessMode: ProjectAccessMode,
): Project[] => {
  if (isAdminAccess(accessMode)) return projects;
  const joinedIds = new Set(joinedProjects.map((item) => item.projectId));
  return projects.filter((project) =>
    joinedIds.has(project.projectId) || joinedIds.has(project.projectType),
  );
};

export const getVisibleProjectIds = (
  projects: Project[],
  joinedProjects: JoinedProject[],
  accessMode: ProjectAccessMode,
): string[] => getVisibleProjects(projects, joinedProjects, accessMode).map((project) => project.projectId);

export const loadLastView = (): LastView | null => {
  try {
    const raw = localStorage.getItem(LAST_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const route = parsed.route;
    if (typeof route !== 'string' || !LAST_VIEW_ROUTES.has(route as LastViewRoute)) return null;

    return {
      route: route as LastViewRoute,
      projectId: typeof parsed.projectId === 'string' && parsed.projectId.trim() ? parsed.projectId : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const hasLastView = (): boolean => {
  try {
    return localStorage.getItem(LAST_VIEW_KEY) !== null;
  } catch {
    return false;
  }
};

export const saveLastView = (route: LastViewRoute, projectId?: string) => {
  const next: LastView = {
    route,
    projectId,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(next));
};

export const clearLastView = () => {
  localStorage.removeItem(LAST_VIEW_KEY);
};
