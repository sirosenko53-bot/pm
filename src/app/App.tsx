import { useEffect, useMemo, useRef, useState } from 'react';
import { WORKSPACE } from '../config/workspaceConfig';
import type { Task, TaskStatus, TaskViewModel } from '../domain/taskTypes';
import type { Workspace } from '../domain/workspaceTypes';
import type { AppRoute } from './routes';
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
import { fetchCalendarEvents, initializeGoogleClient } from '../features/calendar/googleCalendarClient';
import { BackupPanel } from '../features/backup/BackupPanel';
import {
  loadSharedStateMetadata,
  markLocalChangesAfterSharedRead,
  markSharedStateReadFailed,
  setSharedStateSyncStatus,
} from '../features/sharedState/sharedStateStore';
import type { SharedStateMetadata } from '../features/sharedState/sharedStateTypes';
import { tryGetDriveReadAccessTokenSilently } from '../features/sharedState/googleDriveAuth';
import { readSharedStateFromDrive } from '../features/sharedState/sharedStateReadService';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { TodayView } from '../features/today/TodayView';
import { WorkflowView } from '../features/workflow/WorkflowView';
import { ReviewFixView } from '../features/review/ReviewFixView';
import {
  getAllTaskOverlays,
  updateTaskOverlaySortOrders,
  upsertTaskOverlayStatus,
} from '../features/tasks/taskOverlayStore';
import { buildTaskViewModels } from '../features/tasks/taskViewModel';
import { ProjectOverview } from '../features/workspace/ProjectOverview';
import { WorkspaceHome } from '../features/workspace/WorkspaceHome';
import packageInfo from '../../package.json';

const APP_VERSION = packageInfo.version;
const USE_MOCK_CALENDAR = import.meta.env.VITE_USE_MOCK_CALENDAR !== 'false';
const GOOGLE_OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;

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
  const [joinedProjects, setJoinedProjects] = useState<JoinedProject[]>(loadJoinedProjects);
  const [accessMode, setAccessMode] = useState<ProjectAccessMode>(loadProjectAccessMode);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overlays, setOverlays] = useState(getAllTaskOverlays());
  const [calendarStatus, setCalendarStatus] = useState('モック表示中');
  const [calendarError, setCalendarError] = useState<string | undefined>();
  const [storageWarning, setStorageWarning] = useState<string | undefined>();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sharedStateMetadata, setSharedStateMetadata] = useState<SharedStateMetadata>(
    loadSharedStateMetadata().value,
  );
  const autoReadAttemptedWorkspaceRef = useRef<string | null>(null);
  const [lastProjectContextId, setLastProjectContextId] = useState<string | null>(null);

  const taskViewModels: TaskViewModel[] = useMemo(() => {
    return buildTaskViewModels(tasks, overlays, workspace);
  }, [tasks, overlays, workspace]);

  const visibleProjectIds = useMemo(
    () => getVisibleProjectIds(workspace.projects, joinedProjects, accessMode),
    [workspace.projects, joinedProjects, accessMode],
  );

  const visibleProjectIdSet = useMemo(() => new Set(visibleProjectIds), [visibleProjectIds]);

  const visibleProjects = useMemo(
    () => getVisibleProjects(workspace.projects, joinedProjects, accessMode),
    [workspace.projects, joinedProjects, accessMode],
  );

  const visibleWorkspace = useMemo<Workspace>(() => ({
    ...workspace,
    projects: visibleProjects,
    calendarSources: workspace.calendarSources.filter((source) => visibleProjectIdSet.has(source.projectId)),
  }), [workspace, visibleProjects, visibleProjectIdSet]);

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
    void initializeGoogleClient({
      useMock: USE_MOCK_CALENDAR,
      oauthClientId: GOOGLE_OAUTH_CLIENT_ID,
    });
    const sharedMetaResult = loadSharedStateMetadata();
    setSharedStateMetadata(sharedMetaResult.value);
    if (sharedMetaResult.warning) {
      setStorageWarning(sharedMetaResult.warning);
    }
    void loadTasks(workspace);
  }, []);

  const loadTasks = async (nextWorkspace: Workspace) => {
    try {
      const groupedTasks = await Promise.all(
        nextWorkspace.calendarSources.map(async (calendarSource) => {
          const events = await fetchCalendarEvents(calendarSource.calendarId);
          return events.map((event) => mapCalendarEventToTask(event, calendarSource, nextWorkspace));
        }),
      );
      setTasks(groupedTasks.flat());
      setOverlays(getAllTaskOverlays());
      setCalendarStatus(USE_MOCK_CALENDAR ? 'モック表示中（Googleカレンダー差し替え可能）' : 'Googleカレンダー読取済み');
      setLastSyncedAt(new Date().toISOString());
      setCalendarError(undefined);
    } catch (error) {
      setCalendarStatus('取得失敗');
      setCalendarError(error instanceof Error ? error.message : '予定取得に失敗しました。');
    }
  };

  const markProjectOpened = (projectId: string) => {
    const project = workspace.projects.find((item) => item.projectId === projectId);
    if (!project) return;
    setJoinedProjects(updateLastOpenedProject(getAccessProjectId(project)));
  };

  const handleProjectCodeSubmit = (projectCode: string): { ok: true; message?: string } | { ok: false; error: string } => {
    const result = addJoinedProjectsByAccessCode(projectCode);
    if (!result.ok) return result;

    setJoinedProjects(result.joinedProjects);
    setAccessMode(result.accessMode);

    const defaultProject = result.defaultProjectId
      ? findProjectByAccessProjectId(workspace.projects, result.defaultProjectId)
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
    const removedProject = findProjectByAccessProjectId(workspace.projects, projectId);
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

  const openBackup = (projectId?: string) => {
    if (projectId) setLastProjectContextId(projectId);
    setRoute({ name: 'backup-settings', projectId: projectId ?? lastProjectContextId ?? undefined });
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

  const handleSharedStateApplied = (message: string, warning?: string) => {
    setStorageWarning(warning ?? message);
    setOverlays(getAllTaskOverlays());
  };

  useEffect(() => {
    if (autoReadAttemptedWorkspaceRef.current === workspace.workspaceId) return;
    autoReadAttemptedWorkspaceRef.current = workspace.workspaceId;

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
        const message = 'Drive共有JSONの自動読取にはGoogle認証が必要です。設定・バックアップ画面から共有JSONを手動読取してください。';
        const failed = markSharedStateReadFailed(message);
        setSharedStateMetadata(failed.value);
        setStorageWarning(failed.warning ?? message);
        return;
      }

      const readResult = await readSharedStateFromDrive({
        appVersion: APP_VERSION,
        workspace,
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

      setStorageWarning(readResult.warning ?? '共有JSONを自動読取しました。');
      setOverlays(getAllTaskOverlays());
    };

    void autoReadSharedStateIfEnabled();
  }, [
    lastSyncedAt,
    sharedStateMetadata.autoReadSharedStateOnEnter,
    sharedStateMetadata.sharedFileId,
    sharedStateMetadata,
    workspace,
  ]);

  if (joinedProjects.length === 0 || route.name === 'project-code') {
    return <ProjectCodeEntry onSubmit={handleProjectCodeSubmit} />;
  }

  if (route.name === 'joined-projects') {
    return (
      <JoinedProjectsView
        workspace={visibleWorkspace}
        joinedProjects={joinedProjects}
        onOpenProject={(project) => openProjectOverview(project.projectId)}
        onRemoveProject={handleRemoveJoinedProject}
        onSubmitCode={handleAdditionalProjectCodeSubmit}
        onOpenBackup={() => openBackup()}
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
        onBackProject={
          route.fromProjectId
            ? () => openProjectOverview(route.fromProjectId!)
            : undefined
        }
        onOpenToday={route.projectId || route.fromProjectId ? () => openToday((route.projectId ?? route.fromProjectId)!) : undefined}
        onOpenWorkflow={route.projectId || route.fromProjectId ? () => openWorkflow((route.projectId ?? route.fromProjectId)!) : undefined}
        onOpenReviewFix={route.projectId || route.fromProjectId ? () => openReviewFix((route.projectId ?? route.fromProjectId)!) : undefined}
        onOpenBackup={() => openBackup(route.projectId ?? route.fromProjectId)}
        onChangeStatus={handleChangeStatus}
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
        storageWarning={storageWarning}
        onBackHome={() => setRoute({ name: 'workspace-home' })}
        onBackProject={
          route.projectId && visibleProjectIdSet.has(route.projectId) ? () => openProjectOverview(route.projectId!) : undefined
        }
        onRestored={handleBackupRestored}
        sharedStateMetadata={sharedStateMetadata}
        onSharedStateMetadataUpdated={(metadata, warning) => {
          setSharedStateMetadata(metadata);
          if (warning) setStorageWarning(warning);
        }}
        onSharedStateApplied={handleSharedStateApplied}
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
          onOpenBackup={() => openBackup()}
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
        onBackProject={() => openProjectOverview(project.projectId)}
        onOpenWorkflow={() => openWorkflow(project.projectId)}
        onOpenReviewFix={() => openReviewFix(project.projectId)}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
        onChangeStatus={handleChangeStatus}
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
          onOpenBackup={() => openBackup()}
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
        onBackProject={() => openProjectOverview(project.projectId)}
        onOpenToday={() => openToday(project.projectId)}
        onOpenReviewFix={() => openReviewFix(project.projectId)}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
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
          onOpenBackup={() => openBackup()}
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
        onBackProject={() => openProjectOverview(project.projectId)}
        onOpenToday={() => openToday(project.projectId)}
        onOpenWorkflow={() => openWorkflow(project.projectId)}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
        onChangeStatus={handleChangeStatus}
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
          onOpenBackup={() => openBackup()}
        />
      );
    }

    return (
      <ProjectOverview
        workspaceName={workspace.workspaceName}
        project={project}
        tasks={visibleTaskViewModels.filter((task) => task.projectId === project.projectId)}
        storageWarning={storageWarning}
        onBack={() => setRoute({ name: 'workspace-home' })}
        onOpenBoard={() => openTaskBoard(project.projectId, project.projectId)}
        onOpenBackup={() => openBackup(project.projectId)}
        onOpenToday={() => openToday(project.projectId)}
        onOpenWorkflow={() => openWorkflow(project.projectId)}
        onOpenReviewFix={() => openReviewFix(project.projectId)}
      />
    );
  }

  return (
    <WorkspaceHome
      workspace={visibleWorkspace}
      tasks={visibleTaskViewModels}
      calendarStatus={calendarStatus}
      calendarError={calendarError}
      storageWarning={storageWarning}
      onSelectProject={openProjectOverview}
      onOpenBoard={() => openTaskBoard()}
      onOpenBackup={() => openBackup()}
      onOpenJoinedProjects={() => setRoute({ name: 'joined-projects' })}
    />
  );
};
