import { useMemo, useState } from 'react';
import { TASK_STATUSES, type TaskStatus, type TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';
import {
  buildPostponePreviews,
  buildTitleCorrectionPreviews,
} from '../calendar/calendarCorrectionPlan';
import { CommonNav } from '../navigation/CommonNav';
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

const formatCompactDateTime = (value?: string): string => {
  if (!value) return '未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hasTime = value.includes('T') || /\d{1,2}:\d{2}/.test(value);
  return hasTime
    ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};

const formatDueLabel = (task: TaskViewModel): string => {
  if (task.dueDate) return formatCompactDateTime(task.dueDate);
  if (task.endDateTime) return formatCompactDateTime(task.endDateTime);
  if (task.startDateTime) return formatCompactDateTime(task.startDateTime);
  return '未設定';
};

const formatPreviewDateTime = (value?: string): string => {
  if (!value) return '未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const today = new Date();
  const summary = calculateReviewFixSummary(tasks, today);
  const [postponePlanText, setPostponePlanText] = useState('');
  const titleCorrectionPreviews = useMemo(() => buildTitleCorrectionPreviews(tasks), [tasks]);
  const postponePreviews = useMemo(
    () => buildPostponePreviews(tasks, postponePlanText, today),
    [postponePlanText, tasks, today],
  );

  if (!project) return null;

  return (
    <main className="page review-fix-page">
      <section className="card board-header">
        <CommonNav
          workspaceName={workspace.workspaceName}
          projectName={project.projectName}
          primaryItems={[
            { label: '概要', onClick: onBackProject },
            { label: '今日', onClick: onOpenToday },
            { label: '工程', onClick: onOpenWorkflow },
            { label: 'タスク', onClick: onOpenBoard },
            { label: '確認・修正', onClick: () => undefined, active: true },
          ]}
          secondaryItems={[
            { label: 'ワークスペースホームへ戻る', onClick: onBackHome },
            { label: '設定・バックアップ', onClick: onOpenBackup },
          ]}
        />
        <div className="page-title-row">
          <h1>{project.projectName}</h1>
          <span className="pill">確認・修正</span>
        </div>
        <p>{workspace.workspaceName} / {project.projectName}（{project.projectType}）</p>
        <p className="meta">Googleカレンダー正本 / ローカル保存 / JSONバックアップ / Drive共有JSON対応</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="review-fix-dashboard">
        <div className="review-fix-main-grid">
          <article className="card review-fix-column review-fix-column-review">
            <div className="review-fix-column-heading">
              <h2>確認待ち</h2>
              <span className="pill">{summary.reviewWaiting.length}件</span>
            </div>
            <p className="meta">status = 確認待ち のタスク一覧</p>
            <div className="review-fix-task-list">
              {summary.reviewWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.reviewWaiting.map((task) => renderTaskCard(task, onOpenBoard, onChangeStatus))}
            </div>
          </article>

          <article className="card review-fix-column review-fix-column-fix">
            <div className="review-fix-column-heading">
              <h2>修正待ち</h2>
              <span className="pill">{summary.fixWaiting.length}件</span>
            </div>
            <p className="meta">status = 修正待ち のタスク一覧</p>
            <div className="review-fix-task-list">
              {summary.fixWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.fixWaiting.map((task) => renderTaskCard(task, onOpenBoard, onChangeStatus))}
            </div>
          </article>
        </div>

        <aside className="card review-fix-sidebar">
          <h2>状況サマリー</h2>
          <div className="review-fix-stat-list">
            <div className="review-fix-stat"><span>確認待ち</span><strong>{summary.reviewWaiting.length}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>修正待ち</span><strong>{summary.fixWaiting.length}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>期限超過</span><strong>{summary.delayedCount}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>今日対応</span><strong>{summary.todayCount}</strong><small>件</small></div>
          </div>
        </aside>
      </section>

      <section className="card review-fix-insight-card">
        <h2>集計</h2>
        <div className="review-fix-insight-grid">
          <article>
            <h3>担当者別件数</h3>
            <div className="status-row">
              {summary.assigneeGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.assigneeGroups.map((item) => (
                <span key={item.assignee} className="pill">{item.assignee}: {item.count}件</span>
              ))}
            </div>
          </article>
          <article>
            <h3>工程別件数</h3>
            <div className="status-row">
              {summary.stageGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.stageGroups.map((item) => (
                <span key={item.stageName} className="pill">{item.stageName}: {item.count}件</span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="card calendar-correction-panel">
        <div className="calendar-correction-heading">
          <div>
            <h2>Googleカレンダー補正プレビュー</h2>
            <p className="meta">
              書き戻し前に、形式不正の予定名と遅延予定の先送り案を確認します。この画面ではGoogleカレンダーへ書き戻しません。
            </p>
          </div>
          <span className="pill">プレビューのみ</span>
        </div>

        <div className="calendar-correction-grid">
          <article className="calendar-correction-card">
            <h3>形式不正の予定</h3>
            <p className="meta">既定形式: 担当者 / タスク名 / プロジェクト</p>
            {titleCorrectionPreviews.length === 0 ? (
              <p className="empty-state">形式不正の予定はありません。</p>
            ) : (
              <div className="calendar-correction-list">
                {titleCorrectionPreviews.map((preview) => (
                  <article key={preview.taskId} className="calendar-correction-item">
                    <p className="meta">理由: {preview.reason}</p>
                    <dl className="calendar-preview-diff">
                      <div>
                        <dt>現在</dt>
                        <dd>{preview.titleRaw}</dd>
                      </div>
                      <div>
                        <dt>補正案</dt>
                        <dd>{preview.proposedTitle}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="calendar-correction-card">
            <h3>遅延予定の先送り計画</h3>
            <label className="field-label" htmlFor="postpone-plan">
              自然言語メモ
            </label>
            <input
              id="postpone-plan"
              type="text"
              value={postponePlanText}
              onChange={(event) => setPostponePlanText(event.target.value)}
              placeholder="例: 3日後、明日、来週"
            />
            <p className="meta">日数を読み取れない場合は、遅延日数から自動計算します。</p>
            {postponePreviews.length === 0 ? (
              <p className="empty-state">先送り対象の遅延予定はありません。</p>
            ) : (
              <div className="calendar-correction-list">
                {postponePreviews.map((preview) => (
                  <article key={preview.taskId} className="calendar-correction-item">
                    <div className="calendar-correction-item-header">
                      <strong>{preview.taskName}</strong>
                      <span className="warning">{preview.postponeDays}日先送り</span>
                    </div>
                    <p className="meta">計画: {preview.planSource}</p>
                    <dl className="calendar-preview-diff">
                      <div>
                        <dt>現在</dt>
                        <dd>
                          {formatPreviewDateTime(preview.currentStartDateTime)}
                          {' 〜 '}
                          {formatPreviewDateTime(preview.currentEndDateTime ?? preview.currentDueDate)}
                        </dd>
                      </div>
                      <div>
                        <dt>先送り案</dt>
                        <dd>
                          {formatPreviewDateTime(preview.proposedStartDateTime)}
                          {' 〜 '}
                          {formatPreviewDateTime(preview.proposedEndDateTime ?? preview.proposedDueDate)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
};
