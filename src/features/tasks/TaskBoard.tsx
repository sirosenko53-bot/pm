import { useMemo, useState } from 'react';
import { TASK_STATUSES, type TaskStatus, type TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { CommonNav, type CommonNavItem } from '../navigation/CommonNav';

type Props = {
  workspace: Workspace;
  tasks: TaskViewModel[];
  initialProjectId?: string;
  projectContextId?: string;
  storageWarning?: string;
  onBackHome: () => void;
  onBackProject?: () => void;
  onOpenToday?: () => void;
  onOpenWorkflow?: () => void;
  onOpenReviewFix?: () => void;
  onOpenBackup?: () => void;
  onChangeStatus: (task: TaskViewModel, status: TaskStatus) => void;
  onReorder: (
    updates: Array<{ taskId: string; googleCalendarEventId: string; status: TaskStatus; sortOrder: number }>,
  ) => void;
};

const resolveDueText = (task: TaskViewModel) => task.dueDate || task.endDateTime || '-';

const toSortableTime = (value?: string) => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

const compareByNaturalOrder = (a: TaskViewModel, b: TaskViewModel) => {
  const startDiff = toSortableTime(a.startDateTime) - toSortableTime(b.startDateTime);
  if (startDiff !== 0) return startDiff;
  const dueDiff = toSortableTime(a.dueDate) - toSortableTime(b.dueDate);
  if (dueDiff !== 0) return dueDiff;
  return a.taskName.localeCompare(b.taskName, 'ja');
};

const compareByBoardOrder = (a: TaskViewModel, b: TaskViewModel) => {
  const hasA = typeof a.sortOrder === 'number';
  const hasB = typeof b.sortOrder === 'number';
  if (hasA && hasB) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (hasA) return -1;
  if (hasB) return 1;
  return compareByNaturalOrder(a, b);
};

const STATUS_DESCRIPTION: Record<TaskStatus, string> = {
  未着手: 'これから着手するタスク',
  進行中: '現在進めているタスク',
  確認待ち: 'レビュー・確認待ち',
  修正待ち: '修正対応が必要',
  完了: '完了済みタスク',
};

export const TaskBoard = ({
  workspace,
  tasks,
  initialProjectId,
  projectContextId,
  storageWarning,
  onBackHome,
  onBackProject,
  onOpenToday,
  onOpenWorkflow,
  onOpenReviewFix,
  onOpenBackup,
  onChangeStatus,
  onReorder,
}: Props) => {
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? 'all');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const hasProjectContext = Boolean(projectContextId && onBackProject);

  const primaryNavItems: CommonNavItem[] = hasProjectContext
    ? [
        { label: '概要', onClick: onBackProject! },
        ...(onOpenToday ? [{ label: '今日', onClick: onOpenToday }] : []),
        ...(onOpenWorkflow ? [{ label: '工程', onClick: onOpenWorkflow }] : []),
        { label: 'タスク', onClick: () => undefined, active: true },
        ...(onOpenReviewFix ? [{ label: '確認・修正', onClick: onOpenReviewFix }] : []),
      ]
    : [{ label: 'タスク', onClick: () => undefined, active: true }];

  const visibleTasks = useMemo(() => {
    if (selectedProjectId === 'all') return tasks;
    return tasks.filter((task) => task.projectId === selectedProjectId);
  }, [tasks, selectedProjectId]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskViewModel[]>();
    TASK_STATUSES.forEach((status) => map.set(status, []));
    visibleTasks.forEach((task) => {
      map.get(task.status)?.push(task);
    });
    TASK_STATUSES.forEach((status) => map.get(status)?.sort(compareByBoardOrder));
    return map;
  }, [visibleTasks]);

  const taskById = useMemo(() => new Map(visibleTasks.map((task) => [task.taskId, task])), [visibleTasks]);

  const recalcOrders = (status: TaskStatus, statusTasks: TaskViewModel[]) =>
    statusTasks.map((task, index) => ({
      taskId: task.taskId,
      googleCalendarEventId: task.googleCalendarEventId,
      status,
      sortOrder: (index + 1) * 1000,
    }));

  // 同列drop時は、対象カード位置の直前へ挿入する。
  const handleDrop = (targetStatus: TaskStatus, targetTaskId?: string) => {
    if (!draggingTaskId) return;
    const draggedTask = taskById.get(draggingTaskId);
    setDragOverStatus(null);
    setDraggingTaskId(null);
    if (!draggedTask) return;

    if (targetTaskId && targetTaskId === draggedTask.taskId) return;

    const sourceStatus = draggedTask.status;
    const sourceTasks = [...(tasksByStatus.get(sourceStatus) ?? [])].filter(
      (task) => task.taskId !== draggedTask.taskId,
    );
    const targetTasks =
      sourceStatus === targetStatus
        ? sourceTasks
        : [...(tasksByStatus.get(targetStatus) ?? [])].filter((task) => task.taskId !== draggedTask.taskId);

    const insertIndex = targetTaskId
      ? Math.max(0, targetTasks.findIndex((task) => task.taskId === targetTaskId))
      : targetTasks.length;

    const updatedDraggedTask: TaskViewModel = { ...draggedTask, status: targetStatus };
    targetTasks.splice(insertIndex, 0, updatedDraggedTask);

    const updates = [
      ...recalcOrders(targetStatus, targetTasks),
      ...(sourceStatus !== targetStatus ? recalcOrders(sourceStatus, sourceTasks) : []),
    ];

    if (updates.length === 0) return;
    onReorder(updates);
  };

  return (
    <main className="page">
      <section className="card board-header">
        <CommonNav
          primaryItems={primaryNavItems}
          secondaryItems={[
            { label: 'ワークスペースホームへ戻る', onClick: onBackHome },
            ...(onOpenBackup ? [{ label: '設定・バックアップ', onClick: onOpenBackup }] : []),
          ]}
        />
        <h1>タスクボード</h1>
        <p>{workspace.workspaceName}</p>
        <p className="meta board-caption">
          表示中: {selectedProjectId === 'all' ? '全プロジェクト' : workspace.projects.find((project) => project.projectId === selectedProjectId)?.projectName ?? '不明'}
        </p>
        <p className="meta board-caption">Googleカレンダー正本 / ローカル保存 / JSONバックアップ対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
        <div className="board-filter">
          <label htmlFor="project-filter">表示プロジェクト</label>
          <select
            id="project-filter"
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="all">全プロジェクト</option>
            {workspace.projects.map((project) => (
              <option key={project.projectId} value={project.projectId}>{project.projectName}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="board-wrap">
        <div className="board-columns">
          {TASK_STATUSES.map((status) => {
            const statusTasks = tasksByStatus.get(status) ?? [];
            return (
              <article
                key={status}
                className={`board-column card ${dragOverStatus === status ? 'drop-active' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverStatus(status);
                }}
                onDragLeave={() => setDragOverStatus((current) => (current === status ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(status);
                }}
              >
                <header className="board-column-header">
                  <div>
                    <h2>{status}</h2>
                    <p className="meta">{STATUS_DESCRIPTION[status]}</p>
                  </div>
                  <span className="pill">{statusTasks.length}件</span>
                </header>

                <div className="board-cards">
                  {statusTasks.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
                  {statusTasks.map((task) => (
                    <div
                      key={task.taskId}
                      className={`board-card ${draggingTaskId === task.taskId ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', task.taskId);
                        event.dataTransfer.effectAllowed = 'move';
                        setDraggingTaskId(task.taskId);
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDragOverStatus(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragOverStatus(status);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDrop(status, task.taskId);
                      }}
                    >
                      <p className="drag-handle">⋮⋮ ドラッグして移動</p>
                      <p><span className="pill">{task.status}</span></p>
                      <h3>{task.taskName}</h3>
                      <p className="meta">担当: {task.assignee}</p>
                      <p className="meta">プロジェクト: {task.projectName}</p>
                      <p className="meta">工程: {task.stageName}</p>
                      <p className="meta">期限: {resolveDueText(task)}</p>
                      <div className="status-row">
                        {task.isDelayed ? <span className="warning">遅延</span> : null}
                        {task.parseError ? <span className="warning">解析エラー</span> : null}
                        {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
                      </div>
                      <p className="meta">
                        {task.overlayUpdatedAt
                          ? `更新: ${new Date(task.overlayUpdatedAt).toLocaleString()}`
                          : '保存済み: 未作成'}
                      </p>

                      <div className="status-buttons">
                        {TASK_STATUSES.map((nextStatus) => (
                          <button
                            key={nextStatus}
                            type="button"
                            className={`status-button ${task.status === nextStatus ? 'active' : ''}`}
                            onClick={() => onChangeStatus(task, nextStatus)}
                          >
                            {nextStatus}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};
