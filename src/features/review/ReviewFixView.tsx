import { TASK_STATUSES, type TaskStatus, type TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
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

const formatDueLabel = (task: TaskViewModel): string => {
  if (task.dueDate) return task.dueDate;
  if (task.endDateTime) return new Date(task.endDateTime).toLocaleString('ja-JP');
  if (task.startDateTime) return new Date(task.startDateTime).toLocaleString('ja-JP');
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
        <div className="overview-nav">
          <button className="secondary" onClick={onBackHome}>← ワークスペースホーム</button>
          <button className="secondary" onClick={onBackProject}>← プロジェクト概要</button>
          <button className="secondary" onClick={onOpenToday}>今日画面へ</button>
          <button className="secondary" onClick={onOpenWorkflow}>工程画面へ</button>
          <button className="secondary" onClick={onOpenBoard}>タスクボードへ</button>
          <button className="secondary" onClick={onOpenBackup}>設定・バックアップ</button>
        </div>
        <h1>確認・修正画面</h1>
        <p>{workspace.workspaceName} / {project.projectName}（{project.projectType}）</p>
        <p className="meta">Googleカレンダー正本 / ローカル保存 / JSONバックアップ / Drive共有JSON対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="summary-grid">
        <article className="card summary-card"><h3>確認待ち</h3><p>{summary.reviewWaiting.length}件</p></article>
        <article className="card summary-card"><h3>修正待ち</h3><p>{summary.fixWaiting.length}件</p></article>
        <article className="card summary-card"><h3>遅延中</h3><p>{summary.delayedCount}件</p></article>
        <article className="card summary-card"><h3>今日対応</h3><p>{summary.todayCount}件</p></article>
      </section>

      <section className="review-fix-summary-grid">
        <article className="card">
          <h2>担当者別件数</h2>
          <div className="status-row">
            {summary.assigneeGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
            {summary.assigneeGroups.map((item) => (
              <span key={item.assignee} className="pill">{item.assignee}: {item.count}件</span>
            ))}
          </div>
        </article>
        <article className="card">
          <h2>工程別件数</h2>
          <div className="status-row">
            {summary.stageGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
            {summary.stageGroups.map((item) => (
              <span key={item.stageName} className="pill">{item.stageName}: {item.count}件</span>
            ))}
          </div>
        </article>
      </section>

      <section className="review-fix-main-grid">
        <article className="card review-fix-column">
          <h2>確認待ち</h2>
          <p className="meta">status = 確認待ち のタスク一覧</p>
          <div className="review-fix-task-list">
            {summary.reviewWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
            {summary.reviewWaiting.map((task) => renderTaskCard(task, onOpenBoard, onChangeStatus))}
          </div>
        </article>

        <article className="card review-fix-column">
          <h2>修正待ち</h2>
          <p className="meta">status = 修正待ち のタスク一覧</p>
          <div className="review-fix-task-list">
            {summary.fixWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
            {summary.fixWaiting.map((task) => renderTaskCard(task, onOpenBoard, onChangeStatus))}
          </div>
        </article>
      </section>
    </main>
  );
};
