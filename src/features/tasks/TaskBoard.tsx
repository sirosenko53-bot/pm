import { useMemo, useState, type DragEventHandler } from 'react';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
  type TaskViewModel,
} from '../../domain/taskTypes';
import type { WorkflowStage } from '../../domain/workflowTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { CommonNav, type CommonNavItem } from '../navigation/CommonNav';
import { resolveProjectWorkflowStages } from '../workflow/customWorkflowStore';

type BoardGroupMode = 'status' | 'assignee' | 'stage' | 'assignee-stage';
type TaskDetailPatch = {
  assignee: string;
  taskName: string;
  priority: TaskPriority;
  stageId?: string;
  stageName?: string;
};

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
  onUpdateTaskDetails: (task: TaskViewModel, patch: TaskDetailPatch) => void;
  onReorder: (
    updates: Array<{ taskId: string; googleCalendarEventId: string; status: TaskStatus; sortOrder: number }>,
  ) => void;
};

const formatCompactDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hasTime = value.includes('T') || /\d{1,2}:\d{2}/.test(value);
  return hasTime
    ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};

const resolveDueText = (task: TaskViewModel) => formatCompactDateTime(task.dueDate || task.endDateTime);

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

const getGroupKey = (task: TaskViewModel, groupMode: BoardGroupMode) => {
  if (groupMode === 'assignee') return task.assignee || '未設定';
  if (groupMode === 'stage') return task.stageName || '未設定';
  if (groupMode === 'assignee-stage') return `${task.assignee || '未設定'} / ${task.stageName || '未設定'}`;
  return task.status;
};

const groupTasks = (tasks: TaskViewModel[], groupMode: BoardGroupMode) => {
  const groups = new Map<string, TaskViewModel[]>();
  tasks.forEach((task) => {
    const key = getGroupKey(task, groupMode);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([key, value]) => ({ key, tasks: value.sort(compareByNaturalOrder) }));
};

const BoardCard = ({
  task,
  selectedProjectId,
  showStatus,
  stages,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onChangeStatus,
  onUpdateTaskDetails,
}: {
  task: TaskViewModel;
  selectedProjectId: string;
  showStatus: boolean;
  stages: WorkflowStage[];
  draggable: boolean;
  dragging: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  onChangeStatus: (task: TaskViewModel, status: TaskStatus) => void;
  onUpdateTaskDetails: (task: TaskViewModel, patch: TaskDetailPatch) => void;
}) => {
  const priority = task.priority;
  const shouldShowPriority = priority && priority !== TASK_PRIORITIES[1];
  const [assignee, setAssignee] = useState(task.assignee ?? '');
  const [taskName, setTaskName] = useState(task.taskName ?? '');
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority ?? '中');
  const [stageId, setStageId] = useState(task.stageId ?? '');

  const selectedStage = stages.find((stage) => stage.stageId === stageId);
  const handleSaveDetails = () => {
    onUpdateTaskDetails(task, {
      assignee: assignee.trim(),
      taskName: taskName.trim() || task.taskName,
      priority: editPriority,
      stageId: stageId || undefined,
      stageName: selectedStage?.stageName,
    });
  };

  return (
    <div
      className={`board-card board-card-compact ${dragging ? 'dragging' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {draggable ? <p className="drag-handle" aria-label="ドラッグして移動">⋮⋮</p> : null}
      <h3>{task.taskName}</h3>
      <p className="meta board-card-brief">
        {task.assignee || '担当未設定'} / {task.stageName ?? '工程未設定'} / {resolveDueText(task)}
        {selectedProjectId === 'all' ? ` / ${task.projectName}` : ''}
      </p>
      <div className="status-row board-card-tags">
        {showStatus ? <span className="pill">{task.status}</span> : null}
        {shouldShowPriority ? <span className="priority-pill">優先度: {priority}</span> : null}
        {task.isDelayed ? <span className="warning">遅延</span> : null}
        {task.parseError ? <span className="warning">解析エラー</span> : null}
        {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
      </div>

      <label className="board-status-select">
        状態
        <select
          value={task.status}
          onChange={(event) => onChangeStatus(task, event.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>
              {nextStatus}
            </option>
          ))}
        </select>
      </label>

      <details className="board-card-edit-panel">
        <summary>担当・優先度・工程を編集</summary>
        <div className="task-edit-grid board-card-edit-grid">
          <label>
            担当者
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} />
          </label>
          <label>
            優先度
            <select
              value={editPriority}
              onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
            >
              {TASK_PRIORITIES.map((nextPriority) => (
                <option key={nextPriority} value={nextPriority}>
                  {nextPriority}
                </option>
              ))}
            </select>
          </label>
          <label>
            依存する工程
            <select value={stageId} onChange={(event) => setStageId(event.target.value)}>
              <option value="">工程未設定</option>
              {stages.map((stage) => (
                <option key={stage.stageId} value={stage.stageId}>
                  {stage.order}. {stage.stageName}
                </option>
              ))}
            </select>
          </label>
          <label className="task-edit-secondary">
            タスク名（必要な場合だけ修正）
            <input value={taskName} onChange={(event) => setTaskName(event.target.value)} />
          </label>
        </div>
        <button type="button" className="secondary" onClick={handleSaveDetails}>
          変更を保存
        </button>
      </details>
    </div>
  );
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
  onUpdateTaskDetails,
  onReorder,
}: Props) => {
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? 'all');
  const [groupMode, setGroupMode] = useState<BoardGroupMode>('status');
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

  const groupedTasks = useMemo(() => groupTasks(visibleTasks, groupMode), [visibleTasks, groupMode]);
  const taskById = useMemo(() => new Map(visibleTasks.map((task) => [task.taskId, task])), [visibleTasks]);
  const stagesByProjectId = useMemo(
    () => new Map(workspace.projects.map((project) => [project.projectId, resolveProjectWorkflowStages(project)])),
    [workspace.projects],
  );
  const selectedProject = workspace.projects.find((project) => project.projectId === selectedProjectId);
  const boardTitle = projectContextId
    ? workspace.projects.find((project) => project.projectId === projectContextId)?.projectName ?? 'タスクボード'
    : 'タスクボード';

  const recalcOrders = (status: TaskStatus, statusTasks: TaskViewModel[]) =>
    statusTasks.map((task, index) => ({
      taskId: task.taskId,
      googleCalendarEventId: task.googleCalendarEventId,
      status,
      sortOrder: (index + 1) * 1000,
    }));

  const handleDrop = (targetStatus: TaskStatus, targetTaskId?: string) => {
    if (!draggingTaskId || groupMode !== 'status') return;
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
          workspaceName={workspace.workspaceName}
          projectName={projectContextId ? boardTitle : undefined}
          primaryItems={primaryNavItems}
          secondaryItems={[
            { label: 'ワークスペースホームへ戻る', onClick: onBackHome },
            ...(onOpenBackup ? [{ label: '設定・バックアップ', onClick: onOpenBackup }] : []),
          ]}
        />
        <div className="page-title-row">
          <h1>{projectContextId ? boardTitle : 'タスクボード'}</h1>
          <span className="pill">タスク</span>
        </div>
        <p className="meta board-caption">
          表示中: {selectedProjectId === 'all' ? '全プロジェクト' : selectedProject?.projectName ?? '不明'} / 見方: {
            groupMode === 'status' ? '状態' : groupMode === 'assignee' ? '担当者' : groupMode === 'stage' ? '工程' : '担当者＋工程'
          }
        </p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
        <div className="board-view-controls">
          <label htmlFor="project-filter">
            表示範囲
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
          </label>
          <label htmlFor="board-group-mode">
            見方
            <select
              id="board-group-mode"
              value={groupMode}
              onChange={(event) => setGroupMode(event.target.value as BoardGroupMode)}
            >
              <option value="status">状態</option>
              <option value="assignee">担当者</option>
              <option value="assignee-stage">担当者＋工程</option>
              <option value="stage">工程</option>
            </select>
          </label>
        </div>
      </section>

      <section className="board-wrap">
        {groupMode === 'status' ? (
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
                      <p className="meta">{statusTasks.length}件</p>
                    </div>
                  </header>

                  <div className="board-cards">
                    {statusTasks.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
                    {statusTasks.map((task) => (
                      <BoardCard
                        key={task.taskId}
                        task={task}
                        selectedProjectId={selectedProjectId}
                        showStatus={false}
                        stages={stagesByProjectId.get(task.projectId) ?? []}
                        draggable
                        dragging={draggingTaskId === task.taskId}
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
                        onChangeStatus={onChangeStatus}
                        onUpdateTaskDetails={onUpdateTaskDetails}
                      />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="board-columns board-columns-dynamic">
            {groupedTasks.map((group) => (
              <article key={group.key} className="board-column card">
                <header className="board-column-header">
                  <div>
                    <h2>{group.key}</h2>
                    <p className="meta">{group.tasks.length}件</p>
                  </div>
                </header>
                <div className="board-cards">
                  {group.tasks.map((task) => (
                    <BoardCard
                      key={task.taskId}
                      task={task}
                      selectedProjectId={selectedProjectId}
                      showStatus
                      stages={stagesByProjectId.get(task.projectId) ?? []}
                      draggable={false}
                      dragging={false}
                      onChangeStatus={onChangeStatus}
                      onUpdateTaskDetails={onUpdateTaskDetails}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
