import { FormEvent, useState } from 'react';
import type { Project, Workspace } from '../../domain/workspaceTypes';
import type { JoinedProject } from './projectAccessTypes';
import { findProjectByAccessProjectId, getAccessProjectId } from './projectAccessStore';

type Props = {
  workspace: Workspace;
  joinedProjects: JoinedProject[];
  onOpenProject: (project: Project) => void;
  onRemoveProject: (projectId: string) => void;
  onSubmitCode: (code: string) => { ok: true; message?: string } | { ok: false; error: string };
  onOpenBackup: () => void;
};

const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('ja-JP') : '未閲覧';

export const JoinedProjectsView = ({
  workspace,
  joinedProjects,
  onOpenProject,
  onRemoveProject,
  onSubmitCode,
  onOpenBackup,
}: Props) => {
  const [projectCode, setProjectCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const joinedProjectCards = joinedProjects
    .map((joinedProject) => {
      const project = findProjectByAccessProjectId(workspace.projects, joinedProject.projectId);
      return project ? { joinedProject, project } : null;
    })
    .filter((item): item is { joinedProject: JoinedProject; project: Project } => Boolean(item));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const code = projectCode.trim();
    if (!code) {
      setError('プロジェクトコードを入力してください。');
      setMessage('');
      return;
    }

    const result = onSubmitCode(code);
    if (!result.ok) {
      setError(result.error);
      setMessage('');
      return;
    }

    setProjectCode('');
    setError('');
    setMessage(result.message ?? 'プロジェクトコードを追加しました。');
  };

  return (
    <main className="page">
      <section className="card joined-projects-header">
        <div>
          <div className="workspace-brand">
            <span className="app-mark" aria-hidden="true" />
            <strong>制作PM</strong>
          </div>
          <h1>参加中プロジェクト</h1>
          <p className="meta">この端末で参加済みのプロジェクトです。</p>
        </div>
        <button type="button" className="secondary" onClick={onOpenBackup}>設定・バックアップ</button>
      </section>

      <section className="joined-projects-layout">
        {joinedProjectCards.length === 0 ? (
          <article className="card">
            <p className="empty-state">参加中のプロジェクトがありません。</p>
          </article>
        ) : null}
        {joinedProjectCards.map(({ joinedProject, project }) => (
          <article key={joinedProject.projectId} className="card joined-project-card">
            <div className="project-card-header">
              <div className="project-card-title">
                <span className="project-icon" aria-hidden="true">{project.projectName.slice(0, 1)}</span>
                <strong>{project.projectName}</strong>
              </div>
              <span className="pill">種別: {project.projectType}</span>
            </div>
            <div className="project-card-lines">
              <p>
                <span>現在工程</span>
                <strong>{project.currentStageId ?? '未設定'}</strong>
              </p>
              <p>
                <span>次のマイルストーン</span>
                <strong>{project.milestones[0] ?? '未設定'}</strong>
              </p>
            </div>
            <p className="meta">最終閲覧日時: {formatDateTime(joinedProject.lastOpenedAt)}</p>
            <div className="joined-project-actions">
              <button type="button" className="secondary" onClick={() => onOpenProject(project)}>
                このプロジェクトを開く
              </button>
              <button type="button" className="secondary danger" onClick={() => onRemoveProject(getAccessProjectId(project))}>
                参加中から外す
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="card project-code-card">
        <h2>＋ プロジェクトコードを追加</h2>
        <form className="form project-code-form" onSubmit={handleSubmit}>
          <label>
            プロジェクトコード
            <input
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value)}
              placeholder="tokigire-audio"
            />
          </label>
          {error ? <p className="error project-code-error">{error}</p> : null}
          {message ? <p className="note">{message}</p> : null}
          <button type="submit">プロジェクトコードを追加</button>
        </form>
      </section>
    </main>
  );
};
