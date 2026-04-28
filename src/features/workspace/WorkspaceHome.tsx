import type { TaskStatus, TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { TaskDebugList } from '../tasks/TaskDebugList';
import { calculateTaskSummary, filterTasksByProject } from '../tasks/taskMetrics';

type Props = {
  workspace: Workspace;
  tasks: TaskViewModel[];
  calendarStatus: string;
  calendarError?: string;
  storageWarning?: string;
  onSelectProject: (projectId: string) => void;
  onOpenBoard: () => void;
  onOpenBackup: () => void;
  onChangeStatus: (task: TaskViewModel, status: TaskStatus) => void;
};

export const WorkspaceHome = ({
  workspace,
  tasks,
  calendarStatus,
  calendarError,
  storageWarning,
  onSelectProject,
  onOpenBoard,
  onOpenBackup,
  onChangeStatus,
}: Props) => {
  const summary = calculateTaskSummary(tasks);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks
    .filter((task) => {
      const base = task.startDateTime || task.dueDate || task.endDateTime;
      if (!base) return false;
      return new Date(base).toISOString().slice(0, 10) === todayKey;
    })
    .sort((a, b) => {
      const timeA = new Date(a.startDateTime || a.dueDate || a.endDateTime || 0).getTime();
      const timeB = new Date(b.startDateTime || b.dueDate || b.endDateTime || 0).getTime();
      return timeA - timeB;
    });

  const resolveScheduleText = (task: TaskViewModel) => {
    const base = task.startDateTime || task.dueDate || task.endDateTime;
    if (!base) return '時刻未設定';
    return new Date(base).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main className="page">
      <section className="card workspace-home-header">
        <div className="workspace-home-title">
          <h1>{workspace.workspaceName}</h1>
          <p className="meta">ワークスペースホーム</p>
        </div>
        <p>Googleカレンダー連携状態: {calendarStatus}</p>
        <p className="meta">ローカル保存 / JSONバックアップ対応</p>
        {calendarError ? <p className="error">{calendarError}</p> : null}
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
        <div className="overview-nav">
          <button type="button" className="secondary" onClick={onOpenBoard}>全タスクボードを見る</button>
          <button type="button" className="secondary" onClick={onOpenBackup}>設定・バックアップ</button>
        </div>
      </section>

      <section className="summary-grid">
        <article className="card summary-card"><h3>全タスク件数</h3><p>{summary.total}件</p></article>
        <article className="card summary-card"><h3>今日の予定</h3><p>{summary.today}件</p></article>
        <article className="card summary-card"><h3>遅延件数</h3><p>{summary.delayed}件</p></article>
        <article className="card summary-card"><h3>確認待ち</h3><p>{summary.reviewWaiting}件</p></article>
        <article className="card summary-card"><h3>修正待ち</h3><p>{summary.revisionWaiting}件</p></article>
        <article className="card summary-card"><h3>解析エラー</h3><p>{summary.parseError}件</p></article>
        <article className="card summary-card"><h3>未分類</h3><p>{summary.unclassified}件</p></article>
      </section>

      <section className="workspace-main-grid">
        <article className="card">
          <h2>プロジェクトカード</h2>
          <div className="project-grid">
            {workspace.projects.map((project) => {
              const projectTasks = filterTasksByProject(tasks, project.projectId);
              const projectSummary = calculateTaskSummary(projectTasks);
              return (
                <button key={project.projectId} className="project-card" onClick={() => onSelectProject(project.projectId)}>
                  <div className="project-card-header">
                    <strong>{project.projectName}</strong>
                    <span className="pill">種別: {project.projectType}</span>
                  </div>
                  <p className="meta">現在工程: {project.currentStageId ?? '未設定'}</p>
                  <p className="meta">次のマイルストーン: {project.milestones[0] ?? '未設定'}</p>
                  <div className="project-meta-grid">
                    <span>タスク: {projectSummary.total}件</span>
                    <span>今日: {projectSummary.today}件</span>
                    <span className={projectSummary.delayed > 0 ? 'warning-inline' : ''}>遅延: {projectSummary.delayed}件</span>
                    <span>確認待ち: {projectSummary.reviewWaiting}件</span>
                    <span>修正待ち: {projectSummary.revisionWaiting}件</span>
                  </div>
                  <span className="secondary-link">プロジェクト概要へ進む →</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card">
          <h2>今日の予定</h2>
          <p className="meta">本日の予定件数: {summary.today}件</p>
          <div className="today-list">
            {todayTasks.length === 0 ? <p className="empty-state">今日の予定はありません。</p> : null}
            {todayTasks.map((task) => (
              <article key={task.taskId} className="today-item">
                <p className="today-time">{resolveScheduleText(task)}</p>
                <div>
                  <p className="today-title">{task.taskName}</p>
                  <p className="meta">{task.projectName} / 担当: {task.assignee}</p>
                  <p><span className="pill">{task.status}</span></p>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="card" id="task-list">
        <h2>タスク仮一覧</h2>
        <TaskDebugList tasks={tasks} onChangeStatus={onChangeStatus} />
      </section>
    </main>
  );
};
