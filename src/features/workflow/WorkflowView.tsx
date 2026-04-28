import { useMemo, useState } from 'react';
import type { TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import {
  calculateStageProgress,
  calculateStageSummary,
  getCurrentStage,
  getStageTasks,
  getWorkflowTemplateForProject,
  sortStages,
  sortStageTasks,
} from './workflowUtils';

type Props = {
  workspace: Workspace;
  projectId: string;
  tasks: TaskViewModel[];
  storageWarning?: string;
  onBackHome: () => void;
  onBackProject: () => void;
  onOpenToday: () => void;
  onOpenReviewFix: () => void;
  onOpenBoard: () => void;
  onOpenBackup: () => void;
};

export const WorkflowView = ({
  workspace,
  projectId,
  tasks,
  storageWarning,
  onBackHome,
  onBackProject,
  onOpenToday,
  onOpenReviewFix,
  onOpenBoard,
  onOpenBackup,
}: Props) => {
  const project = workspace.projects.find((item) => item.projectId === projectId);
  if (!project) {
    return null;
  }

  const template = getWorkflowTemplateForProject(project);
  const stages = sortStages(template?.stages ?? []);
  const currentStage = getCurrentStage(project, tasks, template);

  const [selectedStageId, setSelectedStageId] = useState(currentStage?.stageId ?? stages[0]?.stageId ?? '');

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.stageId === selectedStageId) ?? currentStage ?? stages[0],
    [stages, selectedStageId, currentStage],
  );

  if (!selectedStage) {
    return (
      <main className="page">
        <section className="card">
          <h1>工程画面</h1>
          <p className="empty-state">ワークフローテンプレートが見つかりません。</p>
        </section>
      </main>
    );
  }

  const stageTasks = sortStageTasks(getStageTasks(selectedStage, tasks));
  const stageSummary = calculateStageSummary(stageTasks);
  const progress = calculateStageProgress(stageTasks);
  const nextStage = stages.find((stage) => stage.order > selectedStage.order);

  return (
    <main className="page">
      <section className="card board-header">
        <div className="overview-nav">
          <button className="secondary" onClick={onBackHome}>← ワークスペースホーム</button>
          <button className="secondary" onClick={onBackProject}>← プロジェクト概要</button>
          <button className="secondary" onClick={onOpenToday}>今日画面へ</button>
          <button className="secondary" onClick={onOpenReviewFix}>確認・修正画面へ</button>
          <button className="secondary" onClick={onOpenBoard}>タスクボードへ</button>
          <button className="secondary" onClick={onOpenBackup}>設定・バックアップ</button>
        </div>
        <h1>工程画面</h1>
        <p>{workspace.workspaceName} / {project.projectName}（{project.projectType}）</p>
        <p className="meta">現在工程: {currentStage?.stageName ?? '未設定'}</p>
        <p className="meta">Googleカレンダー正本 / ローカル保存 / JSONバックアップ対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="workflow-layout">
        <article className="card">
          <h2>工程一覧</h2>
          <div className="workflow-stage-list">
            {stages.map((stage) => {
              const tasksInStage = getStageTasks(stage, tasks);
              const summary = calculateStageSummary(tasksInStage);
              const isSelected = stage.stageId === selectedStage.stageId;
              const isCurrent = stage.stageId === currentStage?.stageId;
              return (
                <button
                  type="button"
                  key={stage.stageId}
                  className={`workflow-stage-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedStageId(stage.stageId)}
                >
                  <div>
                    <strong>{stage.order}. {stage.stageName}</strong>
                    <p className="meta">
                      関連 {summary.total}件 / 完了 {summary.done}件 / 未完了 {summary.todo}件 / 遅延 {summary.delayed}件
                    </p>
                  </div>
                  <span className="pill">{isCurrent ? '現在工程' : '工程'}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card">
          <h2>工程の詳細</h2>
          <p><strong>{selectedStage.stageName}</strong></p>
          <p className="meta">目的: この工程の目的はまだ設定されていません。</p>
          <p className="meta">完了条件: 完了条件は後続フェーズで編集可能にします。</p>
          <p className="meta">次の工程: {nextStage?.stageName ?? 'なし'}</p>
          <p className="meta">関連マイルストーン: {project.milestones[0] ?? '未設定'}</p>
          <p className="meta">進捗率: {progress}%</p>

          <div className="status-row">
            <span className="pill">関連タスク {stageSummary.total}件</span>
            <span className="pill">完了 {stageSummary.done}件</span>
            <span className="pill">未完了 {stageSummary.todo}件</span>
            <span className="pill">遅延 {stageSummary.delayed}件</span>
          </div>

          <h3>関連タスク</h3>
          <div className="today-list">
            {stageTasks.length === 0 ? <p className="empty-state">関連タスクがありません。</p> : null}
            {stageTasks.map((task) => (
              <article className="today-item" key={task.taskId}>
                <p className="today-time">{task.dueDate || task.endDateTime || '-'}</p>
                <div>
                  <p className="today-title">{task.taskName}</p>
                  <p className="meta">担当: {task.assignee} / 工程: {task.stageName}</p>
                  <p>
                    <span className="pill">{task.status}</span>
                    {task.isDelayed ? <span className="warning">遅延</span> : null}
                    {task.parseError ? <span className="warning">解析エラー</span> : null}
                    {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <button className="secondary" onClick={onOpenBoard}>タスクボードで確認する</button>
        </article>
      </section>
    </main>
  );
};
