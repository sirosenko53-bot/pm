import type { TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import { calculateTaskSummary, filterTasksByProject } from '../tasks/taskMetrics';

type Props = {
  workspace: Workspace;
  tasks: TaskViewModel[];
  calendarStatus: string;
  calendarError?: string;
  isReloadingCalendar?: boolean;
  storageWarning?: string;
  onSelectProject: (projectId: string) => void;
  onOpenBoard: () => void;
  onOpenBackup: () => void;
  onOpenJoinedProjects: () => void;
  onReloadCalendar: () => void;
};

export const WorkspaceHome = ({
  workspace,
  tasks,
  calendarStatus,
  calendarError,
  isReloadingCalendar = false,
  storageWarning,
  onSelectProject,
  onOpenBoard,
  onOpenBackup,
  onOpenJoinedProjects,
  onReloadCalendar,
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
            <span>共有は手動</span>
            <button type="button" className="text-action" onClick={onOpenBackup}>設定</button>
          </div>
        </div>
        <div className="workspace-home-title">
          <h1>ワークスペースホーム</h1>
          <p className="meta">{workspace.workspaceName}</p>
        </div>
        <p>コードに紐づくプロジェクトを表示しています</p>
        <p className="meta">Googleカレンダー連携状態: {calendarStatus}</p>
        <p className="meta">ローカル保存 / 復元用ファイル対応</p>
        {calendarError ? <p className="error">{calendarError}</p> : null}
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
        <div className="quick-setup-card" aria-label="初回セットアップ">
          <div className="quick-setup-heading">
            <p className="meta">初回はここだけ確認</p>
            <h2>3ステップで使い始める</h2>
          </div>
          <ol className="quick-setup-steps">
            <li>
              <span className="setup-step-number">1</span>
              <div>
                <strong>プロジェクト参加</strong>
                <p>{workspace.projects.length}件の参加中プロジェクトを表示しています。</p>
              </div>
              <button type="button" className="setup-step-action" onClick={onOpenJoinedProjects}>
                参加を確認
              </button>
            </li>
            <li>
              <span className="setup-step-number">2</span>
              <div>
                <strong>Googleカレンダーを取り込む</strong>
                <p>予定を最新にします。状態: {calendarStatus}</p>
              </div>
              <button type="button" className="setup-step-action primary-lite" onClick={onReloadCalendar} disabled={isReloadingCalendar}>
                {isReloadingCalendar ? '取り込み中' : '予定を更新'}
              </button>
            </li>
            <li>
              <span className="setup-step-number">3</span>
              <div>
                <strong>チーム共有を確認</strong>
                <p>他の端末で保存された進行状況が必要なときだけ開きます。</p>
              </div>
              <button type="button" className="setup-step-action" onClick={onOpenBackup}>
                共有設定へ
              </button>
            </li>
          </ol>
        </div>
        <div className="overview-nav">
          <button type="button" className="secondary" onClick={onReloadCalendar} disabled={isReloadingCalendar}>
            {isReloadingCalendar ? '取り込み中' : 'Googleカレンダーを取り込む'}
          </button>
          <button type="button" className="secondary" onClick={onOpenJoinedProjects}>参加中プロジェクト一覧</button>
          <button type="button" className="secondary" onClick={onOpenBoard}>全タスクボードを見る</button>
          <button type="button" className="secondary" onClick={onOpenBackup}>設定・バックアップ</button>
        </div>
      </section>

      <section className="workspace-main-grid">
        <article className="card project-panel">
          <h2>プロジェクト</h2>
          <div className="project-grid">
            {workspace.projects.map((project) => {
              const projectTasks = filterTasksByProject(tasks, project.projectId);
              const projectSummary = calculateTaskSummary(projectTasks);
              const currentStageLabel =
                projectTasks.find((task) => task.stageId === project.currentStageId)?.stageName ??
                project.currentStageId ??
                '未設定';
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
                      <strong>{currentStageLabel}</strong>
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

      <section className="summary-grid workspace-summary-strip">
        <article className="card summary-card"><h3>全タスク件数</h3><p>{summary.total}件</p></article>
        <article className="card summary-card"><h3>今日の予定</h3><p>{summary.today}件</p></article>
        <article className="card summary-card"><h3>遅延件数</h3><p>{summary.delayed}件</p></article>
        <article className="card summary-card"><h3>確認待ち</h3><p>{summary.reviewWaiting}件</p></article>
        <article className="card summary-card"><h3>修正待ち</h3><p>{summary.revisionWaiting}件</p></article>
        <article className="card summary-card"><h3>解析エラー</h3><p>{summary.parseError}件</p></article>
        <article className="card summary-card"><h3>未分類</h3><p>{summary.unclassified}件</p></article>
      </section>
    </main>
  );
};
