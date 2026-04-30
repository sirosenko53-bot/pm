import { TASK_STATUSES, type TaskStatus, type TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { CommonNav } from '../navigation/CommonNav';
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

const formatCompactDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hasTime = value.includes('T') || /\d{1,2}:\d{2}/.test(value);
  return hasTime
    ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
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
        <CommonNav
          primaryItems={[
            { label: '概要', onClick: onBackProject },
            { label: '今日', onClick: () => undefined, active: true },
            { label: '工程', onClick: onOpenWorkflow },
            { label: 'タスク', onClick: onOpenBoard },
            { label: '確認・修正', onClick: onOpenReviewFix },
          ]}
          secondaryItems={[
            { label: 'ワークスペースホームへ戻る', onClick: onBackHome },
            { label: '設定・バックアップ', onClick: onOpenBackup },
          ]}
        />
        <div className="page-title-row">
          <h1>{project?.projectName ?? 'プロジェクト未選択'}</h1>
          <span className="pill">今日</span>
        </div>
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
                  <p className="today-time">{formatCompactDateTime(task.dueDate)}</p>
                  <div>
                    <p className="today-title">{task.taskName}</p>
                    <p className="meta">担当: {task.assignee} / 工程: {task.stageName}</p>
                    <p><span className="pill">{task.status}</span></p>
                  </div>
                </article>
              ))}
            </div>
            <button type="button" className="card-link-button" onClick={onOpenBoard}>すべて見る</button>
          </article>

          <article className="card">
            <h2>今日中に確認するもの</h2>
            <div className="today-list">
              {todayReviewTasks.length === 0 ? <p className="empty-state">対象タスクはありません。</p> : null}
              {todayReviewTasks.map((task) => (
                <article className="today-item" key={task.taskId}>
                  <p className="today-time">{task.dueDate ? formatCompactDateTime(task.dueDate) : formatTaskTime(task)}</p>
                  <div>
                    <p className="today-title">{task.taskName}</p>
                    <p className="meta">担当: {task.assignee} / 工程: {task.stageName}</p>
                    <p><span className="pill">{task.status}</span></p>
                  </div>
                </article>
              ))}
            </div>
            <button type="button" className="card-link-button" onClick={onOpenBoard}>すべて見る</button>
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
