import type { TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
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
  onOpenJoinedProjects: () => void;
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
  onOpenJoinedProjects,
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
        <div className="workspace-topbar">
          <div className="workspace-brand">
            <span className="app-mark" aria-hidden="true" />
            <strong>制作PM</strong>
          </div>
          <div className="workspace-tools" aria-label="補助情報">
            <span>検索</span>
            <span>同期済み</span>
            <button type="button" className="text-action" onClick={onOpenBackup}>設定</button>
          </div>
        </div>
        <div className="workspace-home-title">
          <h1>{workspace.workspaceName}</h1>
          <p className="meta">ワークスペースホーム</p>
        </div>
        <p>Googleカレンダー連携状態: {calendarStatus}</p>
        <p className="meta">ローカル保存 / JSONバックアップ対応</p>
        {calendarError ? <p className="error">{calendarError}</p> : null}
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
        <div className="overview-nav">
          <button type="button" className="secondary" onClick={onOpenJoinedProjects}>参加中プロジェクト一覧</button>
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
        <article className="card project-panel">
          <h2>プロジェクトカード</h2>
          <div className="project-grid">
            {workspace.projects.map((project) => {
              const projectTasks = filterTasksByProject(tasks, project.projectId);
              const projectSummary = calculateTaskSummary(projectTasks);
              return (
                <button key={project.projectId} type="button" className="project-card" onClick={() => onSelectProject(project.projectId)}>
                  <div className="project-card-header">
                    <div className="project-card-title">
                      <span className="project-icon" aria-hidden="true">{project.projectName.slice(0, 1)}</span>
                      <div>
                        <strong>{project.projectName}</strong>
                        <p className="meta">プロジェクト概要を開く</p>
                      </div>
                    </div>
                    <span className="pill">種別: {project.projectType}</span>
                  </div>
                  <span className="project-card-arrow" aria-hidden="true">開く →</span>
                  <div className="project-card-lines">
                    <p>
                      <span>現在工程</span>
                      <strong>{project.currentStageId ?? '未設定'}</strong>
                    </p>
                    <p>
                      <span>次のマイルストーン</span>
                      <strong>{project.milestones[0] ?? '未設定'}</strong>
                    </p>
                    <p>
                      <span>今日の予定</span>
                      <strong>{projectSummary.today}件</strong>
                    </p>
                  </div>
                  <div className="project-meta-grid">
                    <span>タスク: {projectSummary.total}件</span>
                    <span className={projectSummary.delayed > 0 ? 'warning-inline' : ''}>遅延: {projectSummary.delayed}件</span>
                    <span>確認待ち: {projectSummary.reviewWaiting}件</span>
                    <span>修正待ち: {projectSummary.revisionWaiting}件</span>
                  </div>
                  <span className="project-card-cta">このプロジェクトを開く →</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card today-panel">
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
    </main>
  );
};
