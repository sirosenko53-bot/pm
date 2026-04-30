import { TASK_STATUSES, type TaskStatus, type TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { CommonNav } from '../navigation/CommonNav';
import {
  calculateReviewFixSummary,
  getTodayReviewFixTasks,
} from './reviewFixUtils';

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

const renderTaskCard = (
  task: TaskViewModel,
  onOpenBoard: () => void,
  onChangeStatus: (target: TaskViewModel, status: TaskStatus) => void,
) => (
  <article key={task.taskId} className="review-fix-task-card">
    <div className="review-fix-task-header">
      <p className="review-fix-task-title">{task.taskName}</p>
      <span className="pill">{task.status}</span>
    </div>
    <p className="meta">担当: {task.assignee} / プロジェクト: {task.projectName}</p>
    <p className="meta">工程: {task.stageName ?? '未設定工程'} / 期限: {formatDueLabel(task)}</p>
    {(task.reviewer || task.memo) ? (
      <div className="review-fix-note-box">
        {task.reviewer ? <p className="meta">reviewer: {task.reviewer}</p> : null}
        {task.memo ? <p className="meta">memo: {task.memo}</p> : null}
      </div>
    ) : null}
    <div className="status-row">
      {task.isDelayed ? <span className="warning">遅延</span> : null}
      {task.parseError ? <span className="warning">解析エラー</span> : null}
      {task.isUnclassifiedProject ? <span className="warning">未分類プロジェクト</span> : null}
      {getTodayReviewFixTasks([task], new Date()).length > 0 ? <span className="pill">今日対応</span> : null}
    </div>
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
    <button type="button" className="secondary" onClick={onOpenBoard}>タスクボードで確認</button>
  </article>
);

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
}: Props) => {
  const project = workspace.projects.find((item) => item.projectId === projectId);
  if (!project) return null;

  const today = new Date();
  const summary = calculateReviewFixSummary(tasks, today);

  return (
    <main className="page review-fix-page">
      <section className="card board-header">
        <CommonNav
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
        <p>{workspace.workspaceName} / {project.projectName}（{project.projectType}）</p>
        <p className="meta">Googleカレンダー正本 / ローカル保存 / JSONバックアップ / Drive共有JSON対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="review-fix-dashboard">
        <div className="review-fix-main-grid">
          <article className="card review-fix-column review-fix-column-review">
            <div className="review-fix-column-heading">
              <h2>確認待ち</h2>
              <span className="pill">{summary.reviewWaiting.length}件</span>
            </div>
            <p className="meta">status = 確認待ち のタスク一覧</p>
            <div className="review-fix-task-list">
              {summary.reviewWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.reviewWaiting.map((task) => renderTaskCard(task, onOpenBoard, onChangeStatus))}
            </div>
          </article>

          <article className="card review-fix-column review-fix-column-fix">
            <div className="review-fix-column-heading">
              <h2>修正待ち</h2>
              <span className="pill">{summary.fixWaiting.length}件</span>
            </div>
            <p className="meta">status = 修正待ち のタスク一覧</p>
            <div className="review-fix-task-list">
              {summary.fixWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.fixWaiting.map((task) => renderTaskCard(task, onOpenBoard, onChangeStatus))}
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
    </main>
  );
};
