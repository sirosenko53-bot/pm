import type { TaskViewModel } from '../../domain/taskTypes';
import type { Project } from '../../domain/workspaceTypes';
import { CommonNav } from '../navigation/CommonNav';
import { calculateTaskSummary } from '../tasks/taskMetrics';
import { getWorkflowTemplateForProject } from '../workflow/workflowUtils';

type Props = {
  workspaceName: string;
  project: Project;
  tasks: TaskViewModel[];
  calendarStatus?: string;
  isReloadingCalendar?: boolean;
  storageWarning?: string;
  onBack: () => void;
  onOpenBoard: () => void;
  onOpenBackup: () => void;
  onOpenToday: () => void;
  onOpenWorkflow: () => void;
  onOpenReviewFix: () => void;
  onReloadCalendar?: () => void;
};

const formatOverviewDate = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('ja-JP');
};

const formatOverviewTime = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

export const ProjectOverview = ({
  workspaceName,
  project,
  tasks,
  calendarStatus = '未確認',
  isReloadingCalendar = false,
  storageWarning,
  onBack,
  onOpenBoard,
  onOpenBackup,
  onOpenToday,
  onOpenWorkflow,
  onOpenReviewFix,
  onReloadCalendar,
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
  const workflowTemplate = getWorkflowTemplateForProject(project);
  const currentStage = workflowTemplate?.stages.find((stage) => stage.stageId === project.currentStageId);
  const currentStageLabel =
    currentStage?.stageName ??
    tasks.find((task) => task.stageId === project.currentStageId)?.stageName ??
    project.currentStageId ??
    '未設定';
  const progress = summary.total ? Math.round((summary.statusCounts['完了'] / summary.total) * 100) : 0;
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
        workspaceName={workspaceName}
        projectName={project.projectName}
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
        <p className="meta breadcrumb">ワークスペースホーム 〉 {project.projectName} 〉 概要</p>
        <div className="page-title-row">
          <h1>{project.projectName}</h1>
          <span className="pill">概要</span>
        </div>
        <div className="project-overview-meta-row">
          <span>{workspaceName} / {project.projectName}</span>
          <span className="calendar-state">Googleカレンダー正本</span>
        </div>
        <p className="meta">ローカル保存 / 復元用ファイル対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="quick-setup-card project-quick-setup" aria-label="初回セットアップ">
        <div className="quick-setup-heading">
          <p className="meta">迷ったらこの順番</p>
          <h2>入室後の3ステップ</h2>
        </div>
        <ol className="quick-setup-steps">
          <li>
            <span className="setup-step-number">1</span>
            <div>
              <strong>このプロジェクトを開く</strong>
              <p>{project.projectName}に参加済みです。</p>
            </div>
          </li>
          <li>
            <span className="setup-step-number">2</span>
            <div>
              <strong>予定を更新</strong>
              <p>Googleカレンダーの状態: {calendarStatus}</p>
            </div>
            {onReloadCalendar ? (
              <button type="button" className="setup-step-action primary-lite" onClick={onReloadCalendar} disabled={isReloadingCalendar}>
                {isReloadingCalendar ? '取り込み中' : 'Googleカレンダーを取り込む'}
              </button>
            ) : null}
          </li>
          <li>
            <span className="setup-step-number">3</span>
            <div>
              <strong>チーム共有を確認</strong>
              <p>共有された進行状況が必要なときだけ設定を開きます。</p>
            </div>
            <button type="button" className="setup-step-action" onClick={onOpenBackup}>
              共有設定へ
            </button>
          </li>
        </ol>
      </section>

      <section className="overview-feature-grid">
        <article className="card overview-feature-card overview-current-card">
          <div className="overview-card-heading">
            <span className="overview-card-icon" aria-hidden="true">工</span>
            <h2>現在の工程</h2>
          </div>
          <p className="overview-current-stage-name">{currentStageLabel}</p>
          <div className="progress-block">
            <div className="progress-label">
              <span>工程の進捗</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </article>

        <article className="card overview-feature-card">
          <div className="overview-card-heading">
            <span className="overview-card-icon" aria-hidden="true">旗</span>
            <h2>次のマイルストーン</h2>
          </div>
          <ul className="compact-list">
            {project.milestones.slice(0, 4).map((milestone) => (
              <li key={milestone}><span className="list-dot" aria-hidden="true" />{milestone}</li>
            ))}
            {project.milestones.length === 0 ? <li className="empty-state">未設定</li> : null}
          </ul>
        </article>

        <article className="card overview-feature-card">
          <div className="overview-card-heading">
            <span className="overview-card-icon" aria-hidden="true">今</span>
            <h2>今日やること</h2>
          </div>
          <div className="today-list compact-task-list">
            {todayTasks.length === 0 ? <p className="empty-state">今日の予定はありません。</p> : null}
            {todayTasks.slice(0, 4).map((task) => (
              <article key={task.taskId} className="today-item compact-task-item">
                <p className="today-time">{formatOverviewTime(task.startDateTime || task.dueDate || task.endDateTime)}</p>
                <div>
                  <p className="today-title">{task.taskName}</p>
                  <p className="meta">担当: {task.assignee}</p>
                  <p><span className="pill">{task.status}</span></p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="card overview-feature-card">
          <div className="overview-card-heading">
            <span className="overview-card-icon warning-icon" aria-hidden="true">!</span>
            <h2>遅延・注意</h2>
          </div>
          <p className="meta">遅延件数: {delayedTasks.length}件</p>
          <div className="overview-task-list">
            {delayedTasks.length === 0 ? <p className="empty-state">遅延タスクはありません。</p> : null}
            {delayedTasks.slice(0, 4).map((task) => (
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

        <article className="card overview-feature-card">
          <div className="overview-card-heading">
            <span className="overview-card-icon" aria-hidden="true">確</span>
            <h2>確認・修正</h2>
          </div>
          <p className="meta">確認待ち {summary.reviewWaiting}件 / 修正待ち {summary.revisionWaiting}件</p>
          <div className="today-list compact-task-list">
            {checkAndRevisionTasks.length === 0 ? <p className="empty-state">対象タスクはありません。</p> : null}
            {checkAndRevisionTasks.slice(0, 4).map((task) => (
              <article key={task.taskId} className="today-item compact-task-item">
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
          </div>
        </article>
      </section>

      <section className="overview-bottom-grid">
        <article className="card overview-status-card">
          <h2>プロジェクト状況サマリー</h2>
          <div className="overview-status-grid">
            {Object.entries(summary.statusCounts).map(([status, count]) => (
              <div key={status} className="overview-status-box">
                <span>{status}</span>
                <strong>{count}</strong>
                <small>件</small>
              </div>
            ))}
            <div className={`overview-status-box ${summary.delayed > 0 ? 'danger' : ''}`}>
              <span>遅延</span>
              <strong>{summary.delayed}</strong>
              <small>件</small>
            </div>
          </div>
        </article>

        <article className="card overview-week-card">
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
    </main>
  );
};
