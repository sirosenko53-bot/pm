import { useMemo, useState } from 'react';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
  type TaskViewModel,
} from '../../domain/taskTypes';
import type { WorkflowStage } from '../../domain/workflowTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { CalendarMaintenancePanel } from '../calendar/CalendarMaintenancePanel';
import { CommonNav } from '../navigation/CommonNav';
import { resolveProjectWorkflowStages } from '../workflow/customWorkflowStore';
import { calculateReviewFixSummary } from './reviewFixUtils';

type TaskDetailPatch = {
  assignee: string;
  taskName: string;
  priority: TaskPriority;
  stageId?: string;
  stageName?: string;
};

type Props = {
  workspace: Workspace;
  projectId: string;
  tasks: TaskViewModel[];
  storageWarning?: string;
  onBackHome: () => void;
  onBackProject: () => void;
  onOpenToday: () => void;
  onOpenWorkflow: () => void;
  onOpenBoard: () => void;
  onOpenBackup: () => void;
  onChangeStatus: (task: TaskViewModel, status: TaskStatus) => void;
  onUpdateTaskDetails: (task: TaskViewModel, patch: TaskDetailPatch) => void;
  onCalendarWriteBackComplete: () => void;
};

const formatCompactDateTime = (value?: string): string => {
  if (!value) return '未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hasTime = value.includes('T') || /\d{1,2}:\d{2}/.test(value);
  return hasTime
    ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};

const formatDueLabel = (task: TaskViewModel): string => {
  if (task.dueDate) return formatCompactDateTime(task.dueDate);
  if (task.endDateTime) return formatCompactDateTime(task.endDateTime);
  if (task.startDateTime) return formatCompactDateTime(task.startDateTime);
  return '未設定';
};

const ReviewFixTaskCard = ({
  task,
  stages,
  onOpenBoard,
  onChangeStatus,
  onUpdateTaskDetails,
}: {
  task: TaskViewModel;
  stages: WorkflowStage[];
  onOpenBoard: () => void;
  onChangeStatus: (target: TaskViewModel, status: TaskStatus) => void;
  onUpdateTaskDetails: (target: TaskViewModel, patch: TaskDetailPatch) => void;
}) => {
  const [assignee, setAssignee] = useState(task.assignee);
  const [taskName, setTaskName] = useState(task.taskName);
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? '中');
  const [stageId, setStageId] = useState(task.stageId ?? '');

  const selectedStage = stages.find((stage) => stage.stageId === stageId);

  return (
    <article className="review-fix-task-card">
      <div className="review-fix-task-header">
        <p className="review-fix-task-title">{task.taskName}</p>
        <span className="pill">{task.status}</span>
      </div>
      <p className="meta">
        担当: {task.assignee} / 工程: {task.stageName ?? '未設定'} / 期限: {formatDueLabel(task)}
      </p>
      <p className="meta">優先度: {task.priority ?? '中'}</p>
      <div className="status-row">
        {task.isDelayed ? <span className="warning">遅延</span> : null}
        {task.parseError ? <span className="warning">解析エラー</span> : null}
        {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
      </div>

      <details className="task-edit-panel">
        <summary>担当者・優先度・依存工程を修正</summary>
        <div className="task-edit-grid">
          <label>
            担当者
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} />
          </label>
          <label>
            優先度
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
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
              <option value="">未設定</option>
              {stages.map((stage) => (
                <option key={stage.stageId} value={stage.stageId}>
                  {stage.order}. {stage.stageName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="task-edit-secondary">
          <label>
            タスク名（必要な場合だけ修正）
            <input value={taskName} onChange={(event) => setTaskName(event.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => onUpdateTaskDetails(task, {
            assignee,
            taskName,
            priority,
            stageId: stageId || undefined,
            stageName: selectedStage?.stageName,
          })}
        >
          修正を保存
        </button>
      </details>

      <details className="board-status-menu">
        <summary>状態を変える</summary>
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
      </details>

      <button type="button" className="secondary" onClick={onOpenBoard}>
        タスクボードで見る
      </button>
    </article>
  );
};

export const ReviewFixView = ({
  workspace,
  projectId,
  tasks,
  storageWarning,
  onBackHome,
  onBackProject,
  onOpenToday,
  onOpenWorkflow,
  onOpenBoard,
  onOpenBackup,
  onChangeStatus,
  onUpdateTaskDetails,
  onCalendarWriteBackComplete,
}: Props) => {
  const project = workspace.projects.find((item) => item.projectId === projectId);
  const stages = useMemo(() => (project ? resolveProjectWorkflowStages(project) : []), [project]);
  if (!project) return null;

  const today = new Date();
  const summary = calculateReviewFixSummary(tasks, today);

  return (
    <main className="page review-fix-page">
      <section className="card board-header">
        <CommonNav
          workspaceName={workspace.workspaceName}
          projectName={project.projectName}
          primaryItems={[
            { label: '概要', onClick: onBackProject },
            { label: '今日', onClick: onOpenToday },
            { label: '工程', onClick: onOpenWorkflow },
            { label: 'タスク', onClick: onOpenBoard },
            { label: '確認・修正', onClick: () => undefined, active: true },
          ]}
          secondaryItems={[
            { label: 'ワークスペースホームへ戻る', onClick: onBackHome },
            { label: '設定・バックアップ', onClick: onOpenBackup },
          ]}
        />
        <div className="page-title-row">
          <h1>{project.projectName}</h1>
          <span className="pill">確認・修正</span>
        </div>
        <p>{workspace.workspaceName} / {project.projectName}</p>
        <p className="meta">確認待ち・修正待ちのタスクを確認し、必要に応じて担当者・タスク名・工程を修正できます。</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="review-fix-dashboard">
        <div className="review-fix-main-grid">
          <article className="card review-fix-column review-fix-column-review">
            <div className="review-fix-column-heading">
              <h2>確認待ち</h2>
              <span className="pill">{summary.reviewWaiting.length}件</span>
            </div>
            <div className="review-fix-task-list">
              {summary.reviewWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.reviewWaiting.map((task) => (
                <ReviewFixTaskCard
                  key={task.taskId}
                  task={task}
                  stages={stages}
                  onOpenBoard={onOpenBoard}
                  onChangeStatus={onChangeStatus}
                  onUpdateTaskDetails={onUpdateTaskDetails}
                />
              ))}
            </div>
          </article>

          <article className="card review-fix-column review-fix-column-fix">
            <div className="review-fix-column-heading">
              <h2>修正待ち</h2>
              <span className="pill">{summary.fixWaiting.length}件</span>
            </div>
            <div className="review-fix-task-list">
              {summary.fixWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.fixWaiting.map((task) => (
                <ReviewFixTaskCard
                  key={task.taskId}
                  task={task}
                  stages={stages}
                  onOpenBoard={onOpenBoard}
                  onChangeStatus={onChangeStatus}
                  onUpdateTaskDetails={onUpdateTaskDetails}
                />
              ))}
            </div>
          </article>
        </div>

        <aside className="card review-fix-sidebar">
          <h2>状況サマリー</h2>
          <div className="review-fix-stat-list">
            <div className="review-fix-stat"><span>確認待ち</span><strong>{summary.reviewWaiting.length}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>修正待ち</span><strong>{summary.fixWaiting.length}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>期限超過</span><strong>{summary.delayedCount}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>今日対応</span><strong>{summary.todayCount}</strong><small>件</small></div>
          </div>
        </aside>
      </section>

      <section className="card review-fix-insight-card">
        <h2>集計</h2>
        <div className="review-fix-insight-grid">
          <article>
            <h3>担当者別件数</h3>
            <div className="status-row">
              {summary.assigneeGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.assigneeGroups.map((item) => (
                <span key={item.assignee} className="pill">{item.assignee}: {item.count}件</span>
              ))}
            </div>
          </article>
          <article>
            <h3>工程別件数</h3>
            <div className="status-row">
              {summary.stageGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.stageGroups.map((item) => (
                <span key={item.stageName} className="pill">{item.stageName}: {item.count}件</span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <CalendarMaintenancePanel
        project={project}
        tasks={tasks}
        onWriteBackComplete={onCalendarWriteBackComplete}
      />
    </main>
  );
};
