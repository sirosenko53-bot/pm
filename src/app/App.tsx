import { useEffect, useMemo, useRef, useState } from 'react';
import { WORKSPACE } from '../config/workspaceConfig';
import type { Task, TaskPriority, TaskStatus, TaskViewModel } from '../domain/taskTypes';
import type { Workspace } from '../domain/workspaceTypes';
import type { AppRoute, SettingsSection } from './routes';
import { JoinedProjectsView } from '../features/access/JoinedProjectsView';
import { ProjectCodeEntry } from '../features/access/ProjectCodeEntry';
import type { JoinedProject, ProjectAccessMode } from '../features/access/projectAccessTypes';
import {
  addJoinedProjectsByAccessCode,
  clearLastView,
  findProjectByAccessProjectId,
  getAccessProjectId,
  getVisibleProjectIds,
  getVisibleProjects,
  hasLastView,
  isAdminAccess,
  loadLastView,
  loadJoinedProjects,
  loadProjectAccessMode,
  removeJoinedProject,
  saveLastView,
  updateLastOpenedProject,
} from '../features/access/projectAccessStore';
import { mapCalendarEventToTask } from '../features/calendar/calendarMapper';
import {
  buildCalendarConnectionDiagnostic,
  buildCalendarImportSummary,
  isPlaceholderCalendarId,
  type CalendarImportSummary,
} from '../features/calendar/calendarDiagnostics';
import { loadCalendarTaskCache, saveCalendarTaskCache } from '../features/calendar/calendarTaskCache';
import {
  applyCalendarSourceSettings,
  loadCalendarSourceSettings,
} from '../features/calendar/calendarSourceSettings';
import {
  fetchCalendarEvents,
  initializeGoogleClient,
  isUsingMockCalendar,
  requestGoogleCalendarReadWriteAccessToken,
} from '../features/calendar/googleCalendarClient';
import { BackupPanel } from '../features/backup/BackupPanel';
import {
  applyDefaultSharedDriveFileSettings,
  loadSharedStateMetadata,
  markLocalChangesAfterSharedRead,
  markSharedStateReadFailed,
  setSharedStateSyncStatus,
} from '../features/sharedState/sharedStateStore';
import type { SharedStateMetadata } from '../features/sharedState/sharedStateTypes';
import { tryGetDriveReadAccessTokenSilently } from '../features/sharedState/googleDriveAuth';
import { readSharedStateFromDrive } from '../features/sharedState/sharedStateReadService';
import {
  addCustomMember,
  deleteMemberCandidate,
  loadCustomMembers,
  loadDeletedMemberIds,
  loadHiddenMemberIds,
  mergeMembers,
  removeMemberCandidate,
  restoreMemberCandidate,
} from '../features/members/memberStore';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { TodayView } from '../features/today/TodayView';
import { WorkflowView } from '../features/workflow/WorkflowView';
import { ReviewFixView } from '../features/review/ReviewFixView';
import {
  getAllTaskOverlays,
  updateTaskOverlaySortOrders,
  upsertTaskOverlayDetails,
  upsertTaskOverlayStatus,
} from '../features/tasks/taskOverlayStore';
import { buildTaskViewModels } from '../features/tasks/taskViewModel';
import { ProjectOverview } from '../features/workspace/ProjectOverview';
import { WorkspaceHome } from '../features/workspace/WorkspaceHome';
import packageInfo from '../../package.json';

const APP_VERSION = packageInfo.version;

const isProjectVisible = (projectId: string, joinedProjects: JoinedProject[], accessMode: ProjectAccessMode) => {
  if (isAdminAccess(accessMode)) {
    return WORKSPACE.projects.some((project) => project.projectId === projectId);
  }
  return getVisibleProjectIds(WORKSPACE.projects, joinedProjects, accessMode).includes(projectId);
};

const createFallbackRoute = (joinedProjects: JoinedProject[], accessMode: ProjectAccessMode): AppRoute => {
  if (!isAdminAccess(accessMode) && joinedProjects.length === 1) {
    const project = findProjectByAccessProjectId(WORKSPACE.projects, joinedProjects[0].projectId);
    if (project) return { name: 'project-overview', projectId: project.projectId };
  }
  return { name: 'joined-projects' };
};

const createInitialRoute = (): AppRoute => {
  const joinedProjects = loadJoinedProjects();
  const accessMode = loadProjectAccessMode();
  if (joinedProjects.length === 0) return { name: 'project-code' };

  const hasSavedLastView = hasLastView();
  const lastView = loadLastView();
  if (!lastView) {
    if (hasSavedLastView) {
      clearLastView();
      return { name: 'joined-projects' };
    }
    return createFallbackRoute(joinedProjects, accessMode);
  }

  if (lastView.route === 'joined-projects') return { name: 'joined-projects' };
  if (lastView.route === 'workspace-home') return { name: 'workspace-home' };

  if (lastView.route === 'task-board' && !lastView.projectId) {
    return { name: 'task-board' };
  }
  if (lastView.route === 'backup-settings' && !lastView.projectId) {
    return { name: 'backup-settings' };
  }

  if (!lastView.projectId) {
    return { name: 'joined-projects' };
  }

  const project = findProjectByAccessProjectId(WORKSPACE.projects, lastView.projectId);
  if (!project || !isProjectVisible(project.projectId, joinedProjects, accessMode)) {
    clearLastView();
    return { name: 'joined-projects' };
  }

  if (lastView.route === 'project-overview') return { name: 'project-overview', projectId: project.projectId };
  if (lastView.route === 'today') return { name: 'today', projectId: project.projectId };
  if (lastView.route === 'workflow') return { name: 'workflow', projectId: project.projectId };
  if (lastView.route === 'review-fix') return { name: 'review-fix', projectId: project.projectId };
  if (lastView.route === 'task-board') {
    return { name: 'task-board', projectId: project.projectId, fromProjectId: project.projectId };
  }
  if (lastView.route === 'backup-settings') return { name: 'backup-settings', projectId: project.projectId };

  return { name: 'joined-projects' };
};

export const App = () => {
  const [route, setRoute] = useState<AppRoute>(createInitialRoute);
  const [workspace] = useState<Workspace>(WORKSPACE);
  const [initialCalendarTaskCache] = useState(() => loadCalendarTaskCache(WORKSPACE.workspaceId));
  const [calendarSourceSettings, setCalendarSourceSettings] = useState(loadCalendarSourceSettings);
  const [customMembers, setCustomMembers] = useState(loadCustomMembers);
  const [hiddenMemberIds, setHiddenMemberIds] = useState(loadHiddenMemberIds);
  const [deletedMemberIds, setDeletedMemberIds] = useState(loadDeletedMemberIds);
  const [joinedProjects, setJoinedProjects] = useState<JoinedProject[]>(loadJoinedProjects);
  const [accessMode, setAccessMode] = useState<ProjectAccessMode>(loadProjectAccessMode);
  const [tasks, setTasks] = useState<Task[]>(() => initialCalendarTaskCache.value?.tasks ?? []);
  const [overlays, setOverlays] = useState(getAllTaskOverlays());
  const [calendarStatus, setCalendarStatus] = useState(() =>
    initialCalendarTaskCache.value
      ? `${initialCalendarTaskCache.value.calendarStatus}（前回取り込みを表示中）`
      : '未取り込み',
  );
  const [calendarError, setCalendarError] = useState<string | undefined>();
  const [calendarImportSummary, setCalendarImportSummary] = useState<CalendarImportSummary | undefined>(
    () => initialCalendarTaskCache.value?.calendarImportSummary,
  );
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isConnectingGoogleCalendar, setIsConnectingGoogleCalendar] = useState(false);
  const [calendarReadAccessToken, setCalendarReadAccessToken] = useState<string | undefined>();
  const [calendarAuthStatus, setCalendarAuthStatus] = useState('未接続');
  const [storageWarning, setStorageWarning] = useState<string | undefined>(() => initialCalendarTaskCache.warning);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => initialCalendarTaskCache.value?.cachedAt ?? null,
  );
  const [sharedStateMetadata, setSharedStateMetadata] = useState<SharedStateMetadata>(
    loadSharedStateMetadata().value,
  );
  const autoReadAttemptedWorkspaceRef = useRef<string | null>(null);
  const [lastProjectContextId, setLastProjectContextId] = useState<string | null>(null);

  const workspaceWithMembers = useMemo<Workspace>(() => ({
    ...workspace,
    members: mergeMembers(workspace.members, customMembers, hiddenMemberIds, deletedMemberIds),
  }), [workspace, customMembers, hiddenMemberIds, deletedMemberIds]);

  const hiddenMembers = useMemo(
    () => workspace.members.filter((member) =>
      hiddenMemberIds.includes(member.memberId) && !deletedMemberIds.includes(member.memberId),
    ),
    [workspace.members, hiddenMemberIds, deletedMemberIds],
  );

  const configuredWorkspace = useMemo(
    () => applyCalendarSourceSettings(workspaceWithMembers, calendarSourceSettings),
    [workspaceWithMembers, calendarSourceSettings],
  );

  const taskViewModels: TaskViewModel[] = useMemo(() => {
    return buildTaskViewModels(tasks, overlays, configuredWorkspace);
  }, [tasks, overlays, configuredWorkspace]);

  const visibleProjectIds = useMemo(
    () => getVisibleProjectIds(configuredWorkspace.projects, joinedProjects, accessMode),
    [configuredWorkspace.projects, joinedProjects, accessMode],
  );

  const visibleProjectIdSet = useMemo(() => new Set(visibleProjectIds), [visibleProjectIds]);

  const visibleProjects = useMemo(
    () => getVisibleProjects(configuredWorkspace.projects, joinedProjects, accessMode),
    [configuredWorkspace.projects, joinedProjects, accessMode],
  );

  const visibleWorkspace = useMemo<Workspace>(() => ({
    ...configuredWorkspace,
    projects: visibleProjects,
    calendarSources: configuredWorkspace.calendarSources.filter((source) => visibleProjectIdSet.has(source.projectId)),
  }), [configuredWorkspace, visibleProjects, visibleProjectIdSet]);

  const calendarDiagnostics = useMemo(
    () => buildCalendarConnectionDiagnostic(visibleWorkspace),
    [visibleWorkspace],
  );

  const visibleTaskViewModels = useMemo(
    () => taskViewModels.filter((task) => visibleProjectIdSet.has(task.projectId)),
    [taskViewModels, visibleProjectIdSet],
  );

  useEffect(() => {
    if (joinedProjects.length === 0 || route.name === 'project-code') return;

    if (route.name === 'joined-projects' || route.name === 'workspace-home') {
      saveLastView(route.name);
      return;
    }

    if (route.name === 'task-board') {
      const projectId = route.projectId ?? route.fromProjectId;
      if (!projectId || visibleProjectIdSet.has(projectId)) {
        saveLastView('task-board', projectId);
      }
      return;
    }

    if (route.name === 'backup-settings' && !route.projectId) {
      saveLastView('backup-settings');
      return;
    }

    const projectId = route.projectId;
    if (projectId && visibleProjectIdSet.has(projectId)) {
      saveLastView(route.name, projectId);
    }
  }, [joinedProjects.length, route, visibleProjectIdSet]);

  useEffect(() => {
    const useMock = import.meta.env.VITE_USE_MOCK_CALENDAR !== 'false';
    const oauthClientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
    void initializeGoogleClient({ useMock, oauthClientId });
    const sharedMetaResult = applyDefaultSharedDriveFileSettings();
    setSharedStateMetadata(sharedMetaResult.value);
    if (sharedMetaResult.warning) {
      setStorageWarning(sharedMetaResult.warning);
    }
  }, []);

  const loadTasks = async (nextWorkspace: Workspace) => {
    setIsLoadingTasks(true);
    setCalendarError(undefined);
    try {
      const useMockCalendar = isUsingMockCalendar();
      let calendarAccessToken = calendarReadAccessToken;
      if (!useMockCalendar) {
        if (!calendarAccessToken) {
          setCalendarStatus('Google認証を待っています');
          const authResult = await requestGoogleCalendarReadWriteAccessToken();
          if (!authResult.ok) {
            setCalendarAuthStatus('未接続');
            throw new Error(authResult.error);
          }
          calendarAccessToken = authResult.accessToken;
          setCalendarReadAccessToken(authResult.accessToken);
        }
        setCalendarAuthStatus('接続済み（この画面の操作中のみ）');
        setCalendarStatus('Googleカレンダー取得中');
      } else {
        setCalendarStatus('モック予定を取り込み中');
      }

      const sourceResults = await Promise.all(
        nextWorkspace.calendarSources.map(async (calendarSource) => {
          if (!useMockCalendar && isPlaceholderCalendarId(calendarSource.calendarId)) {
            return {
              source: calendarSource,
              events: [],
              tasks: [],
              skipped: true,
              skipReason: 'カレンダーID未設定',
            };
          }

          const events = await fetchCalendarEvents(calendarSource.calendarId, calendarAccessToken);
          return {
            source: calendarSource,
            events,
            tasks: events.map((event) => mapCalendarEventToTask(event, calendarSource, nextWorkspace)),
          };
        }),
      );
      const nextTasks = sourceResults.flatMap((result) => result.tasks);
      const updatedAt = new Date().toISOString();
      const skippedSourceCount = sourceResults.filter((result) => result.skipped).length;
      const nextCalendarStatus = useMockCalendar
        ? 'モック表示中（Googleカレンダー差し替え可能）'
        : skippedSourceCount > 0
          ? 'Googleカレンダー読取済み（一部未設定）'
          : 'Googleカレンダー読取済み';
      const nextCalendarImportSummary = buildCalendarImportSummary({
        useMockCalendar,
        sourceResults,
        updatedAt,
      });
      setTasks(nextTasks);
      setOverlays(getAllTaskOverlays());
      setCalendarStatus(nextCalendarStatus);
      setCalendarImportSummary(nextCalendarImportSummary);
      setLastSyncedAt(updatedAt);
      const cacheResult = saveCalendarTaskCache({
        workspaceId: nextWorkspace.workspaceId,
        tasks: nextTasks,
        calendarStatus: nextCalendarStatus,
        calendarImportSummary: nextCalendarImportSummary,
        cachedAt: updatedAt,
      });
      if (cacheResult.warning) {
        setStorageWarning(cacheResult.warning);
      }
      setCalendarError(undefined);
    } catch (error) {
      setCalendarStatus('取得失敗');
      setCalendarError(error instanceof Error ? error.message : '予定取得に失敗しました。');
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleConnectGoogleCalendar = async () => {
    setCalendarError(undefined);
    setIsConnectingGoogleCalendar(true);
    setCalendarAuthStatus('接続中');

    try {
      if (isUsingMockCalendar()) {
        setCalendarAuthStatus('モック表示中');
        setCalendarError('現在はモック表示中です。実カレンダーを読むには VITE_USE_MOCK_CALENDAR=false にしてください。');
        return;
      }

      const authResult = await requestGoogleCalendarReadWriteAccessToken();
      if (!authResult.ok) {
        setCalendarReadAccessToken(undefined);
        setCalendarAuthStatus('未接続');
        setCalendarError(authResult.error);
        return;
      }

      setCalendarReadAccessToken(authResult.accessToken);
      setCalendarAuthStatus('接続済み（この画面の操作中のみ）');
      setCalendarStatus('Googleアカウント接続済み（読取・修正を許可）');
    } finally {
      setIsConnectingGoogleCalendar(false);
    }
  };

  const markProjectOpened = (projectId: string) => {
    const project = configuredWorkspace.projects.find((item) => item.projectId === projectId);
    if (!project) return;
    setJoinedProjects(updateLastOpenedProject(getAccessProjectId(project)));
  };

  const handleProjectCodeSubmit = (projectCode: string): { ok: true; message?: string } | { ok: false; error: string } => {
    const result = addJoinedProjectsByAccessCode(projectCode);
    if (!result.ok) return result;

    setJoinedProjects(result.joinedProjects);
    setAccessMode(result.accessMode);

    const defaultProject = result.defaultProjectId
      ? findProjectByAccessProjectId(configuredWorkspace.projects, result.defaultProjectId)
      : undefined;

    if (defaultProject && !isAdminAccess(result.accessMode)) {
      markProjectOpened(defaultProject.projectId);
      setLastProjectContextId(defaultProject.projectId);
      setRoute({ name: 'project-overview', projectId: defaultProject.projectId });
      return { ok: true, message: `${result.label}に参加しました。` };
    }

    setRoute({ name: 'joined-projects' });
    return { ok: true, message: `${result.label}を参加中プロジェクトに追加しました。` };
  };

  const handleAdditionalProjectCodeSubmit = (projectCode: string): { ok: true; message?: string } | { ok: false; error: string } => {
    const result = addJoinedProjectsByAccessCode(projectCode);
    if (!result.ok) return result;

    setJoinedProjects(result.joinedProjects);
    setAccessMode(result.accessMode);
    setRoute({ name: 'joined-projects' });

    if (result.alreadyJoined) {
      return { ok: true, message: 'このプロジェクトはすでに参加済みです。' };
    }

    return { ok: true, message: `${result.label}を参加中プロジェクトに追加しました。` };
  };

  const handleRemoveJoinedProject = (projectId: string) => {
    const removedProject = findProjectByAccessProjectId(configuredWorkspace.projects, projectId);
    const lastView = loadLastView();
    const next = removeJoinedProject(projectId);
    setJoinedProjects(next);
    setAccessMode(loadProjectAccessMode());
    if (next.length === 0) {
      clearLastView();
      setRoute({ name: 'project-code' });
      return;
    }
    if (
      lastView?.projectId
      && removedProject
      && findProjectByAccessProjectId([removedProject], lastView.projectId)
    ) {
      saveLastView('joined-projects');
    }
    setRoute({ name: 'joined-projects' });
  };

  const openProjectOverview = (projectId: string) => {
    if (!visibleProjectIdSet.has(projectId)) {
      setRoute(joinedProjects.length === 0 ? { name: 'project-code' } : { name: 'joined-projects' });
      return;
    }
    markProjectOpened(projectId);
    setLastProjectContextId(projectId);
    setRoute({ name: 'project-overview', projectId });
  };

  const openToday = (projectId: string) => {
    setLastProjectContextId(projectId);
    setRoute({ name: 'today', projectId });
  };

  const openWorkflow = (projectId: string) => {
    setLastProjectContextId(projectId);
    setRoute({ name: 'workflow', projectId });
  };

  const openReviewFix = (projectId: string) => {
    setLastProjectContextId(projectId);
    setRoute({ name: 'review-fix', projectId });
  };

  const openTaskBoard = (projectId?: string, fromProjectId?: string) => {
    if (projectId) setLastProjectContextId(projectId);
    if (fromProjectId) setLastProjectContextId(fromProjectId);
    setRoute({ name: 'task-board', projectId, fromProjectId });
  };

  const openBackup = (projectId?: string, section: SettingsSection = 'backup') => {
    if (projectId) setLastProjectContextId(projectId);
    setRoute({ name: 'backup-settings', projectId: projectId ?? lastProjectContextId ?? undefined, section });
  };

  const openCalendarSettings = (projectId?: string) => {
    openBackup(projectId, 'calendar');
  };

  const openSharedSettings = (projectId?: string) => {
    openBackup(projectId, 'shared');
  };

  const handleChangeStatus = (task: TaskViewModel, status: TaskStatus) => {
    if (task.status === status) {
      return;
    }

    const result = upsertTaskOverlayStatus(task.taskId, task.googleCalendarEventId, status);
    const sharedMetaResult = markLocalChangesAfterSharedRead();
    setStorageWarning(result.warning ?? sharedMetaResult.warning);
    setSharedStateMetadata(sharedMetaResult.value);
    setOverlays(getAllTaskOverlays());
  };

  const handleUpdateTaskDetails = (
    task: TaskViewModel,
    patch: { assignee: string; taskName: string; priority: TaskPriority; stageId?: string; stageName?: string },
  ) => {
    const result = upsertTaskOverlayDetails(task, {
      assigneeOverride: patch.assignee,
      taskNameOverride: patch.taskName,
      stageOverride: patch.stageId,
      stageNameOverride: patch.stageName,
      priority: patch.priority,
    });
    const sharedMetaResult = markLocalChangesAfterSharedRead();
    setStorageWarning(result.warning ?? sharedMetaResult.warning);
    setSharedStateMetadata(sharedMetaResult.value);
    setOverlays(getAllTaskOverlays());
  };

  const handleReorder = (
    updates: Array<{ taskId: string; googleCalendarEventId: string; status: TaskStatus; sortOrder: number }>,
  ) => {
    if (updates.length === 0) return;
    const result = updateTaskOverlaySortOrders(updates);
    const sharedMetaResult = markLocalChangesAfterSharedRead();
    setStorageWarning(result.warning ?? sharedMetaResult.warning);
    setSharedStateMetadata(sharedMetaResult.value);
    setOverlays(getAllTaskOverlays());
  };

  const handleBackupRestored = (message: string, warning?: string) => {
    const sharedMetaResult = markLocalChangesAfterSharedRead();
    setStorageWarning(warning ?? sharedMetaResult.warning ?? message);
    setSharedStateMetadata(sharedMetaResult.value);
    setOverlays(getAllTaskOverlays());
  };

  const handleAddMember = (displayName: string) => {
    const result = addCustomMember(workspace.members, customMembers, displayName, hiddenMemberIds, deletedMemberIds);
    setCustomMembers(result.members);
    setHiddenMemberIds(result.hiddenMemberIds);
    setDeletedMemberIds(result.deletedMemberIds);
    if (result.warning) setStorageWarning(result.warning);
    return result;
  };

  const handleRemoveMember = (memberId: string) => {
    const result = removeMemberCandidate(workspace.members, customMembers, hiddenMemberIds, deletedMemberIds, memberId);
    setCustomMembers(result.members);
    setHiddenMemberIds(result.hiddenMemberIds);
    setDeletedMemberIds(result.deletedMemberIds);
    if (result.warning) setStorageWarning(result.warning);
    return result;
  };

  const handleDeleteMember = (memberId: string) => {
    const result = deleteMemberCandidate(workspace.members, customMembers, hiddenMemberIds, deletedMemberIds, memberId);
    setCustomMembers(result.members);
    setHiddenMemberIds(result.hiddenMemberIds);
    setDeletedMemberIds(result.deletedMemberIds);
    if (result.warning) setStorageWarning(result.warning);
    return result;
  };

  const handleRestoreMember = (memberId: string) => {
    const result = restoreMemberCandidate(workspace.members, customMembers, hiddenMemberIds, deletedMemberIds, memberId);
    setCustomMembers(result.members);
    setHiddenMemberIds(result.hiddenMemberIds);
    setDeletedMemberIds(result.deletedMemberIds);
    if (result.warning) setStorageWarning(result.warning);
    return result;
  };

  const handleSharedStateApplied = (message: string, warning?: string) => {
    setStorageWarning(warning ?? message);
    setOverlays(getAllTaskOverlays());
  };

  useEffect(() => {
    if (autoReadAttemptedWorkspaceRef.current === configuredWorkspace.workspaceId) return;
    autoReadAttemptedWorkspaceRef.current = configuredWorkspace.workspaceId;

    const shouldAutoRead =
      sharedStateMetadata.autoReadSharedStateOnEnter
      && Boolean(sharedStateMetadata.sharedFileId)
      && sharedStateMetadata.sharedFileId !== null;

    if (!shouldAutoRead) {
      return;
    }

    const autoReadSharedStateIfEnabled = async () => {
      const loading = setSharedStateSyncStatus('loading');
      setSharedStateMetadata(loading.value);
      if (loading.warning) {
        setStorageWarning(loading.warning);
      }

      const tokenResult = await tryGetDriveReadAccessTokenSilently();
      if (!tokenResult.ok) {
        const message = '共有データの自動読み込みにはGoogle認証が必要です。設定・バックアップ画面から手動で読み込んでください。';
        const failed = markSharedStateReadFailed(message);
        setSharedStateMetadata(failed.value);
        setStorageWarning(failed.warning ?? message);
        return;
      }

      const readResult = await readSharedStateFromDrive({
        appVersion: APP_VERSION,
        workspace: configuredWorkspace,
        metadata: sharedStateMetadata,
        fileId: sharedStateMetadata.sharedFileId ?? '',
        accessToken: tokenResult.accessToken,
        lastSyncedAt,
      });

      setSharedStateMetadata(readResult.metadata);
      if (!readResult.ok) {
        setStorageWarning(
          readResult.warning ?? '共有状態の自動読取に失敗しました。ローカル状態で表示しています。',
        );
        return;
      }

      setStorageWarning(readResult.warning ?? '共有データを自動で読み込みました。');
      setOverlays(getAllTaskOverlays());
    };

    void autoReadSharedStateIfEnabled();
  }, [
    lastSyncedAt,
    sharedStateMetadata.autoReadSharedStateOnEnter,
    sharedStateMetadata.sharedFileId,
    sharedStateMetadata,
    configuredWorkspace,
  ]);

  if (joinedProjects.length === 0 || route.name === 'project-code') {
    return (
      <ProjectCodeEntry
        calendarAuthStatus={calendarAuthStatus}
        calendarStatus={calendarStatus}
        isConnectingGoogle={isConnectingGoogleCalendar}
        isMockMode={calendarDiagnostics.isMockMode}
        onConnectGoogleCalendar={() => void handleConnectGoogleCalendar()}
        onSubmit={handleProjectCodeSubmit}
      />
    );
  }

  if (route.name === 'joined-projects') {
    return (
      <JoinedProjectsView
        workspace={visibleWorkspace}
        joinedProjects={joinedProjects}
        onOpenProject={(project) => openProjectOverview(project.projectId)}
        onRemoveProject={handleRemoveJoinedProject}
        onSubmitCode={handleAdditionalProjectCodeSubmit}
        onOpenHome={() => setRoute({ name: 'workspace-home' })}
        onOpenBackup={() => openBackup()}
        onOpenCalendarSettings={() => openCalendarSettings()}
        onOpenSharedSettings={() => openSharedSettings()}
      />
    );
  }

  if (route.name === 'task-board') {
    return (
      <TaskBoard
        workspace={visibleWorkspace}
        tasks={visibleTaskViewModels}
        initialProjectId={route.projectId}
        projectContextId={route.projectId ?? route.fromProjectId}
        storageWarning={storageWarning}
        onBackHome={() => setRoute({ name: 'workspace-home' })}
        onOpenProjects={() => setRoute({ name: 'joined-projects' })}
        onBackProject={
          route.fromProjectId
            ? () => openProjectOverview(route.fromProjectId!)
            : undefined
        }
        onOpenToday={route.projectId || route.fromProjectId ? () => openToday((route.projectId ?? route.fromProjectId)!) : undefined}
        onOpenWorkflow={route.projectId || route.fromProjectId ? () => openWorkflow((route.projectId ?? route.fromProjectId)!) : undefined}
        onOpenReviewFix={route.projectId || route.fromProjectId ? () => openReviewFix((route.projectId ?? route.fromProjectId)!) : undefined}
        onOpenCalendarSettings={() => openCalendarSettings(route.projectId ?? route.fromProjectId)}
        onOpenBackup={() => openBackup(route.projectId ?? route.fromProjectId)}
        onOpenSettings={() => openSharedSettings(route.projectId ?? route.fromProjectId)}
        onChangeStatus={handleChangeStatus}
        onUpdateTaskDetails={handleUpdateTaskDetails}
        onReorder={handleReorder}
      />
    );
  }

  if (route.name === 'backup-settings') {
    return (
      <BackupPanel
        workspace={visibleWorkspace}
        appVersion={APP_VERSION}
        lastSyncedAt={lastSyncedAt}
        calendarStatus={calendarStatus}
        calendarError={calendarError}
        calendarDiagnostics={calendarDiagnostics}
        calendarImportSummary={calendarImportSummary}
        calendarAuthStatus={calendarAuthStatus}
        isConnectingGoogle={isConnectingGoogleCalendar}
        isReloadingCalendar={isLoadingTasks}
        initialSection={route.section}
        storageWarning={storageWarning}
        onBackHome={() => setRoute({ name: 'workspace-home' })}
        onBackProject={
          route.projectId && visibleProjectIdSet.has(route.projectId) ? () => openProjectOverview(route.projectId!) : undefined
        }
        onConnectGoogleCalendar={() => void handleConnectGoogleCalendar()}
        onReloadCalendar={() => void loadTasks(visibleWorkspace)}
        hiddenMembers={hiddenMembers}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onDeleteMember={handleDeleteMember}
        onRestoreMember={handleRestoreMember}
        onRestored={handleBackupRestored}
        sharedStateMetadata={sharedStateMetadata}
        onSharedStateMetadataUpdated={(metadata, warning) => {
          setSharedStateMetadata(metadata);
          if (warning) setStorageWarning(warning);
        }}
        onSharedStateApplied={handleSharedStateApplied}
        onCalendarSourceSettingsUpdated={() => setCalendarSourceSettings(loadCalendarSourceSettings())}
      />
    );
  }

  if (route.name === 'today') {
    const project = visibleWorkspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return (
        <JoinedProjectsView
          workspace={visibleWorkspace}
          joinedProjects={joinedProjects}
          onOpenProject={(item) => openProjectOverview(item.projectId)}
          onRemoveProject={handleRemoveJoinedProject}
          onSubmitCode={handleAdditionalProjectCodeSubmit}
          onOpenHome={() => setRoute({ name: 'workspace-home' })}
          onOpenBackup={() => openBackup()}
          onOpenCalendarSettings={() => openCalendarSettings()}
          onOpenSharedSettings={() => openSharedSettings()}
        />
      );
    }

    return (
      <TodayView
        workspace={visibleWorkspace}
        projectId={project.projectId}
        tasks={visibleTaskViewModels.filter((task) => task.projectId === project.projectId)}
        storageWarning={storageWarning}
        onBackHome={() => setRoute({ name: 'workspace-home' })}
        onOpenProjects={() => setRoute({ name: 'joined-projects' })}
        onBackProject={() => openProjectOverview(project.projectId)}
        onOpenWorkflow={() => openWorkflow(project.projectId)}
        onOpenReviewFix={() => openReviewFix(project.projectId)}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenCalendarSettings={() => openCalendarSettings(project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
        onOpenSettings={() => openSharedSettings(project.projectId)}
      />
    );
  }

  if (route.name === 'workflow') {
    const project = visibleWorkspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return (
        <JoinedProjectsView
          workspace={visibleWorkspace}
          joinedProjects={joinedProjects}
          onOpenProject={(item) => openProjectOverview(item.projectId)}
          onRemoveProject={handleRemoveJoinedProject}
          onSubmitCode={handleAdditionalProjectCodeSubmit}
          onOpenHome={() => setRoute({ name: 'workspace-home' })}
          onOpenBackup={() => openBackup()}
          onOpenCalendarSettings={() => openCalendarSettings()}
          onOpenSharedSettings={() => openSharedSettings()}
        />
      );
    }

    return (
      <WorkflowView
        workspace={visibleWorkspace}
        projectId={project.projectId}
        tasks={visibleTaskViewModels.filter((task) => task.projectId === project.projectId)}
        storageWarning={storageWarning}
        onBackHome={() => setRoute({ name: 'workspace-home' })}
        onOpenProjects={() => setRoute({ name: 'joined-projects' })}
        onBackProject={() => openProjectOverview(project.projectId)}
        onOpenToday={() => openToday(project.projectId)}
        onOpenReviewFix={() => openReviewFix(project.projectId)}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenCalendarSettings={() => openCalendarSettings(project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
        onOpenSettings={() => openSharedSettings(project.projectId)}
      />
    );
  }

  if (route.name === 'review-fix') {
    const project = visibleWorkspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return (
        <JoinedProjectsView
          workspace={visibleWorkspace}
          joinedProjects={joinedProjects}
          onOpenProject={(item) => openProjectOverview(item.projectId)}
          onRemoveProject={handleRemoveJoinedProject}
          onSubmitCode={handleAdditionalProjectCodeSubmit}
          onOpenHome={() => setRoute({ name: 'workspace-home' })}
          onOpenBackup={() => openBackup()}
          onOpenCalendarSettings={() => openCalendarSettings()}
          onOpenSharedSettings={() => openSharedSettings()}
        />
      );
    }

    return (
      <ReviewFixView
        workspace={visibleWorkspace}
        projectId={project.projectId}
        tasks={visibleTaskViewModels.filter((task) => task.projectId === project.projectId)}
        storageWarning={storageWarning}
        onBackHome={() => setRoute({ name: 'workspace-home' })}
        onOpenProjects={() => setRoute({ name: 'joined-projects' })}
        onBackProject={() => openProjectOverview(project.projectId)}
        onOpenToday={() => openToday(project.projectId)}
        onOpenWorkflow={() => openWorkflow(project.projectId)}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenCalendarSettings={() => openCalendarSettings(project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
        onOpenSettings={() => openSharedSettings(project.projectId)}
        onChangeStatus={handleChangeStatus}
        onUpdateTaskDetails={handleUpdateTaskDetails}
        onCalendarWriteBackComplete={() => void loadTasks(visibleWorkspace)}
      />
    );
  }

  if (route.name === 'project-overview') {
    const project = visibleWorkspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return (
        <JoinedProjectsView
          workspace={visibleWorkspace}
          joinedProjects={joinedProjects}
          onOpenProject={(item) => openProjectOverview(item.projectId)}
          onRemoveProject={handleRemoveJoinedProject}
          onSubmitCode={handleAdditionalProjectCodeSubmit}
          onOpenHome={() => setRoute({ name: 'workspace-home' })}
          onOpenBackup={() => openBackup()}
          onOpenCalendarSettings={() => openCalendarSettings()}
          onOpenSharedSettings={() => openSharedSettings()}
        />
      );
    }

    return (
      <ProjectOverview
        workspaceName={workspace.workspaceName}
        project={project}
        tasks={visibleTaskViewModels.filter((task) => task.projectId === project.projectId)}
        calendarStatus={calendarStatus}
        isReloadingCalendar={isLoadingTasks}
        storageWarning={storageWarning}
        onBack={() => setRoute({ name: 'workspace-home' })}
        onOpenProjects={() => setRoute({ name: 'joined-projects' })}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenCalendarSettings={() => openCalendarSettings(project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
        onOpenSettings={() => openSharedSettings(project.projectId)}
        onOpenToday={() => openToday(project.projectId)}
        onOpenWorkflow={() => openWorkflow(project.projectId)}
        onOpenReviewFix={() => openReviewFix(project.projectId)}
        onReloadCalendar={() => void loadTasks(visibleWorkspace)}
      />
    );
  }

  return (
    <WorkspaceHome
      workspace={visibleWorkspace}
      tasks={visibleTaskViewModels}
      calendarStatus={calendarStatus}
      calendarError={calendarError}
      calendarDiagnostics={calendarDiagnostics}
      calendarImportSummary={calendarImportSummary}
      isReloadingCalendar={isLoadingTasks}
      isConnectingGoogle={isConnectingGoogleCalendar}
      calendarAuthStatus={calendarAuthStatus}
      storageWarning={storageWarning}
      onSelectProject={openProjectOverview}
      onOpenBoard={() => openTaskBoard()}
      onOpenBackup={() => openBackup()}
      onOpenCalendarSettings={() => openCalendarSettings()}
      onOpenSharedSettings={() => openSharedSettings()}
      onOpenJoinedProjects={() => setRoute({ name: 'joined-projects' })}
      onConnectGoogleCalendar={() => void handleConnectGoogleCalendar()}
      onReloadCalendar={() => void loadTasks(visibleWorkspace)}
    />
  );
};
