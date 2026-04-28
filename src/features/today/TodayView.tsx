import { TASK_STATUSES, type TaskStatus, type TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { calculateTaskSummary } from '../tasks/taskMetrics';
import { formatTaskTime, isDueToday, isTodayTask, sortTodayTasks } from './todayUtils';

type Props = {
  workspace: Workspace;
  projectId: string;
  tasks: TaskViewModel[];
  storageWarning?: string;
  onBackHome: () => void;
  onBackProject: () => void;
  onOpenWorkflow: () => void;
  onOpenReviewFix: () => void;
  onOpenBoard: () => void;
  onOpenBackup: () => void;
  onChangeStatus: (task: TaskViewModel, status: TaskStatus) => void;
};

export const TodayView = ({
  workspace,
  projectId,
  tasks,
  storageWarning,
  onBackHome,
  onBackProject,
  onOpenWorkflow,
  onOpenReviewFix,
  onOpenBoard,
  onOpenBackup,
  onChangeStatus,
}: Props) => {
  const project = workspace.projects.find((item) => item.projectId === projectId);
  const today = new Date();

  const todayTasks = sortTodayTasks(tasks.filter((task) => isTodayTask(task, today)));
  const dueTodayTasks = todayTasks.filter((task) => isDueToday(task, today) && task.status !== '完了');
  const todayReviewTasks = todayTasks.filter((task) => task.status === '確認待ち' || task.status === '修正待ち');
  const summary = calculateTaskSummary(todayTasks);

  return (
    <main className="page">
      <section className="card board-header">
        <div className="overview-nav">
          <button className="secondary" onClick={onBackHome}>← ワークスペースホーム</button>
          <button className="secondary" onClick={onBackProject}>← プロジェクト概要</button>
          <button className="secondary" onClick={onOpenWorkflow}>工程画面へ</button>
          <button className="secondary" onClick={onOpenReviewFix}>確認・修正画面へ</button>
          <button className="secondary" onClick={onOpenBoard}>タスクボードへ</button>
          <button className="secondary" onClick={onOpenBackup}>設定・バックアップ</button>
        </div>
        <h1>今日画面</h1>
        <p>{workspace.workspaceName} / {project?.projectName ?? 'プロジェクト未選択'}</p>
        <p className="meta">{today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</p>
        <p className="meta">Googleカレンダー正本 / ローカル保存 / JSONバックアップ対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="today-layout">
        <article className="card">
          <h2>今日の予定タイムライン</h2>
          <div className="today-list">
            {todayTasks.length === 0 ? <p className="empty-state">今日の予定はありません。</p> : null}
            {todayTasks.map((task) => (
              <article key={task.taskId} className="today-item">
                <p className="today-time">{formatTaskTime(task)}</p>
                <div>
                  <p className="today-title">{task.taskName}</p>
                  <p className="meta">担当: {task.assignee} / プロジェクト: {task.projectName}</p>
                  <p className="meta">工程: {task.stageName}</p>
                  <p>
                    <span className="pill">{task.status}</span>
                    {task.isDelayed ? <span className="warning">遅延</span> : null}
                    {task.parseError ? <span className="warning">解析エラー</span> : null}
                    {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
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
              </article>
            ))}
          </div>
        </article>

        <div className="today-side-grid">
          <article className="card">
            <h2>今日締切</h2>
            <div className="today-list">
              {dueTodayTasks.length === 0 ? <p className="empty-state">今日締切の未完了タスクはありません。</p> : null}
              {dueTodayTasks.map((task) => (
                <article className="today-item" key={task.taskId}>
                  <p className="today-time">{task.dueDate ?? '-'}</p>
                  <div>
                    <p className="today-title">{task.taskName}</p>
                    <p className="meta">担当: {task.assignee} / 工程: {task.stageName}</p>
                    <p><span className="pill">{task.status}</span></p>
                  </div>
                </article>
              ))}
            </div>
            <button className="secondary" onClick={onOpenBoard}>タスクボードで対応する</button>
          </article>

          <article className="card">
            <h2>今日中に確認するもの</h2>
            <div className="today-list">
              {todayReviewTasks.length === 0 ? <p className="empty-state">対象タスクはありません。</p> : null}
              {todayReviewTasks.map((task) => (
                <article className="today-item" key={task.taskId}>
                  <p className="today-time">{task.dueDate ?? formatTaskTime(task)}</p>
                  <div>
                    <p className="today-title">{task.taskName}</p>
                    <p className="meta">担当: {task.assignee} / 工程: {task.stageName}</p>
                    <p><span className="pill">{task.status}</span></p>
                  </div>
                </article>
              ))}
            </div>
            <button className="secondary" onClick={onOpenBoard}>タスクボードで確認する</button>
          </article>
        </div>
      </section>

      <section className="summary-grid">
        <article className="card summary-card"><h3>今日の予定</h3><p>{todayTasks.length}件</p></article>
        <article className="card summary-card"><h3>完了</h3><p>{summary.statusCounts['完了']}件</p></article>
        <article className="card summary-card"><h3>進行中</h3><p>{summary.statusCounts['進行中']}件</p></article>
        <article className="card summary-card"><h3>確認待ち</h3><p>{summary.statusCounts['確認待ち']}件</p></article>
        <article className="card summary-card"><h3>修正待ち</h3><p>{summary.statusCounts['修正待ち']}件</p></article>
        <article className="card summary-card"><h3>未着手</h3><p>{summary.statusCounts['未着手']}件</p></article>
        <article className="card summary-card"><h3>遅延</h3><p>{summary.delayed}件</p></article>
      </section>
    </main>
  );
};
