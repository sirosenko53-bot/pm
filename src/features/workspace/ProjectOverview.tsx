import type { TaskViewModel } from '../../domain/taskTypes';
import type { Project } from '../../domain/workspaceTypes';
import { CommonNav } from '../navigation/CommonNav';
import { calculateTaskSummary } from '../tasks/taskMetrics';

type Props = {
  workspaceName: string;
  project: Project;
  tasks: TaskViewModel[];
  storageWarning?: string;
  onBack: () => void;
  onOpenBoard: () => void;
  onOpenBackup: () => void;
  onOpenToday: () => void;
  onOpenWorkflow: () => void;
  onOpenReviewFix: () => void;
};

const formatOverviewDate = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('ja-JP');
};

export const ProjectOverview = ({
  workspaceName,
  project,
  tasks,
  storageWarning,
  onBack,
  onOpenBoard,
  onOpenBackup,
  onOpenToday,
  onOpenWorkflow,
  onOpenReviewFix,
}: Props) => {
  const summary = calculateTaskSummary(tasks);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const todayTasks = tasks
    .filter((task) => {
      const base = task.startDateTime || task.dueDate || task.endDateTime;
      if (!base) return false;
      return new Date(base).toISOString().slice(0, 10) === todayKey;
    })
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  const delayedTasks = tasks.filter((task) => task.isDelayed);
  const checkAndRevisionTasks = tasks.filter((task) => task.status === '確認待ち' || task.status === '修正待ち');
  const weeklyTasks = tasks
    .filter((task) => {
      const base = new Date(task.startDateTime || task.dueDate || task.endDateTime || 0);
      const diff = base.getTime() - today.getTime();
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
    })
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())
    .slice(0, 5);

  return (
    <main className="page">
      <CommonNav
        primaryItems={[
          { label: '概要', onClick: () => undefined, active: true },
          { label: '今日', onClick: onOpenToday },
          { label: '工程', onClick: onOpenWorkflow },
          { label: 'タスク', onClick: onOpenBoard },
          { label: '確認・修正', onClick: onOpenReviewFix },
        ]}
        secondaryItems={[
          { label: 'ワークスペースホームへ戻る', onClick: onBack },
          { label: '設定・バックアップ', onClick: onOpenBackup },
        ]}
      />
      <section className="card project-overview-header">
        <p className="meta">ワークスペース: {workspaceName}</p>
        <h1>{project.projectName}</h1>
        <p className="meta">種別: {project.projectType}</p>
        <p>現在工程: {project.currentStageId ?? '未設定'} <span className="meta">（仮算出を含む）</span></p>
        <p>次のマイルストーン: {project.milestones[0] ?? '未設定'}</p>
        <p className="meta">Googleカレンダー正本 / ローカル保存 / JSONバックアップ対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="summary-grid">
        <article className="card summary-card"><h3>現在工程</h3><p>{project.currentStageId ?? '未設定'}</p></article>
        <article className="card summary-card"><h3>次のマイルストーン</h3><p>{project.milestones[0] ?? '未設定'}</p></article>
        <article className="card summary-card"><h3>今日やること</h3><p>{todayTasks.length}件</p></article>
        <article className="card summary-card"><h3>遅延・注意</h3><p>{summary.delayed}件</p></article>
        <article className="card summary-card"><h3>確認待ち</h3><p>{summary.reviewWaiting}件</p></article>
        <article className="card summary-card"><h3>修正待ち</h3><p>{summary.revisionWaiting}件</p></article>
      </section>

      <section className="overview-main-grid">
        <article className="card">
          <h2>今日やること</h2>
          <div className="today-list">
            {todayTasks.length === 0 ? <p className="empty-state">今日の予定はありません。</p> : null}
            {todayTasks.map((task) => (
              <article key={task.taskId} className="today-item">
                <p className="today-time">{new Date(task.startDateTime || task.dueDate || task.endDateTime || '').toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</p>
                <div>
                  <p className="today-title">{task.taskName}</p>
                  <p className="meta">担当: {task.assignee}</p>
                  <p><span className="pill">{task.status}</span></p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>遅延・注意</h2>
          <p className="meta">遅延件数: {delayedTasks.length}件</p>
          <div className="overview-task-list">
            {delayedTasks.length === 0 ? <p className="empty-state">遅延タスクはありません。</p> : null}
            {delayedTasks.slice(0, 5).map((task) => (
              <article key={task.taskId} className="overview-task-item">
                <p className="overview-task-title">{task.taskName}</p>
                <p className="overview-task-meta">担当: {task.assignee}</p>
                <p className="overview-task-tags">
                  <span className="warning">遅延</span>
                  <span className="pill">{task.status}</span>
                </p>
                <p className="overview-task-meta">期限: {formatOverviewDate(task.dueDate ?? task.endDateTime ?? task.startDateTime)}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>確認・修正</h2>
          <p className="meta">確認待ち {summary.reviewWaiting}件 / 修正待ち {summary.revisionWaiting}件</p>
          <div className="today-list">
            {checkAndRevisionTasks.length === 0 ? <p className="empty-state">対象タスクはありません。</p> : null}
            {checkAndRevisionTasks.slice(0, 5).map((task) => (
              <article key={task.taskId} className="today-item">
                <p className="today-time">-</p>
                <div>
                  <p className="today-title">{task.taskName}</p>
                  <p><span className="pill">{task.status}</span></p>
                </div>
              </article>
            ))}
          </div>
          <div className="overview-nav">
            <button type="button" className="secondary" onClick={onOpenReviewFix}>確認・修正画面へ</button>
            <button type="button" className="secondary" onClick={onOpenBoard}>タスクボードで確認する</button>
          </div>
        </article>

        <article className="card">
          <h2>状況サマリー</h2>
          <div className="project-meta-grid">
            {Object.entries(summary.statusCounts).map(([status, count]) => (
              <span key={status}>{status}: {count}件</span>
            ))}
            <span className={summary.delayed > 0 ? 'warning-inline' : ''}>遅延: {summary.delayed}件</span>
          </div>
        </article>

        <article className="card">
          <h2>今週の予定</h2>
          <div className="overview-task-list">
            {weeklyTasks.length === 0 ? <p className="empty-state">今週の予定はありません。</p> : null}
            {weeklyTasks.map((task) => (
              <article key={task.taskId} className="overview-task-item">
                <p className="overview-task-title">{task.taskName}</p>
                <p className="overview-task-meta">{task.projectName} / 担当: {task.assignee}</p>
                <p className="overview-task-tags">
                  <span className="pill">{task.status}</span>
                </p>
                <p className="overview-task-meta">予定日: {formatOverviewDate(task.dueDate ?? task.startDateTime ?? task.endDateTime)}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <h2>状態サマリー（ピル表示）</h2>
        <div className="status-row">
          {Object.entries(summary.statusCounts).map(([status, count]) => (
            <span className="pill" key={status}>{status}: {count}</span>
          ))}
        </div>
      </section>
    </main>
  );
};
