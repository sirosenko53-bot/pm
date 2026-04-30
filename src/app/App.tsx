import { useEffect, useMemo, useRef, useState } from 'react';
import { findWorkspaceByCode } from '../config/workspaceConfig';
import type { Task, TaskStatus, TaskViewModel } from '../domain/taskTypes';
import type { Workspace } from '../domain/workspaceTypes';
import type { AppRoute } from './routes';
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
import { WorkspaceCodeScreen } from '../features/workspace/WorkspaceCodeScreen';
import { WorkspaceHome } from '../features/workspace/WorkspaceHome';
import packageInfo from '../../package.json';

const APP_VERSION = packageInfo.version;

export const App = () => {
  const [route, setRoute] = useState<AppRoute>({ name: 'workspace-code' });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
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
    if (!workspace) return [];
    return buildTaskViewModels(tasks, overlays, workspace);
  }, [tasks, overlays, workspace]);

  useEffect(() => {
    void initializeGoogleClient({ useMock: true });
    const sharedMetaResult = loadSharedStateMetadata();
    setSharedStateMetadata(sharedMetaResult.value);
    if (sharedMetaResult.warning) {
      setStorageWarning(sharedMetaResult.warning);
    }
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
      setCalendarStatus('モック表示中（Googleカレンダー差し替え可能）');
      setLastSyncedAt(new Date().toISOString());
      setCalendarError(undefined);
    } catch (error) {
      setCalendarStatus('取得失敗');
      setCalendarError(error instanceof Error ? error.message : '予定取得に失敗しました。');
    }
  };

  const handleWorkspaceCodeSubmit = (workspaceCode: string) => {
    const nextWorkspace = findWorkspaceByCode(workspaceCode);
    if (!nextWorkspace) return false;
    setWorkspace(nextWorkspace);
    setRoute({ name: 'workspace-home' });
    void loadTasks(nextWorkspace);
    return true;
  };

  const openProjectOverview = (projectId: string) => {
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
    if (!workspace) return;
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

  if (!workspace || route.name === 'workspace-code') {
    return <WorkspaceCodeScreen onSubmit={handleWorkspaceCodeSubmit} />;
  }

  if (route.name === 'task-board') {
    return (
      <TaskBoard
        workspace={workspace}
        tasks={taskViewModels}
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
        workspace={workspace}
        appVersion={APP_VERSION}
        lastSyncedAt={lastSyncedAt}
        storageWarning={storageWarning}
        onBackHome={() => setRoute({ name: 'workspace-home' })}
        onBackProject={
          route.projectId ? () => openProjectOverview(route.projectId!) : undefined
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
    const project = workspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return null;
    }

    return (
      <TodayView
        workspace={workspace}
        projectId={project.projectId}
        tasks={taskViewModels.filter((task) => task.projectId === project.projectId)}
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
    const project = workspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return null;
    }

    return (
      <WorkflowView
        workspace={workspace}
        projectId={project.projectId}
        tasks={taskViewModels.filter((task) => task.projectId === project.projectId)}
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
    const project = workspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return null;
    }

    return (
      <ReviewFixView
        workspace={workspace}
        projectId={project.projectId}
        tasks={taskViewModels.filter((task) => task.projectId === project.projectId)}
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
    const project = workspace.projects.find((item) => item.projectId === route.projectId);
    if (!project) {
      return null;
    }

    return (
      <ProjectOverview
        workspaceName={workspace.workspaceName}
        project={project}
        tasks={taskViewModels.filter((task) => task.projectId === project.projectId)}
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
      workspace={workspace}
      tasks={taskViewModels}
      calendarStatus={calendarStatus}
      calendarError={calendarError}
      storageWarning={storageWarning}
      onSelectProject={openProjectOverview}
      onOpenBoard={() => openTaskBoard()}
      onOpenBackup={() => openBackup()}
    />
  );
};
