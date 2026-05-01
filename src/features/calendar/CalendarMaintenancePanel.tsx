import { useMemo, useState } from 'react';
import type { TaskViewModel } from '../../domain/taskTypes';
import type { Project } from '../../domain/workspaceTypes';
import type { CalendarWriteBackDraft } from './calendarWriteBackTypes';
import {
  createPostponeDraft,
  createTitleNormalizeDraft,
  exportCalendarWriteBackBackup,
  parsePostponeInstruction,
} from './calendarMaintenanceUtils';
import { requestGoogleCalendarWriteAccessToken, updateCalendarEvent } from './googleCalendarClient';

type Props = {
  project: Project;
  tasks: TaskViewModel[];
  onWriteBackComplete: () => void;
};

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return value.includes('T')
    ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};

const reasonLabel = (draft: CalendarWriteBackDraft): string =>
  draft.reason === 'title-normalize' ? '予定名を整える' : '先送り';

export const CalendarMaintenancePanel = ({ project, tasks, onWriteBackComplete }: Props) => {
  const [postponeTaskId, setPostponeTaskId] = useState('');
  const [postponePrompt, setPostponePrompt] = useState('');
  const [postponeDate, setPostponeDate] = useState('');
  const [drafts, setDrafts] = useState<CalendarWriteBackDraft[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isWriting, setIsWriting] = useState(false);

  const invalidTasks = useMemo(
    () => tasks.filter((task) => task.parseError || task.isUnclassifiedProject),
    [tasks],
  );

  const delayedTasks = useMemo(
    () => tasks.filter((task) => task.isDelayed),
    [tasks],
  );

  const selectedPostponeTask = delayedTasks.find((task) => task.taskId === postponeTaskId) ?? delayedTasks[0];

  const appendDrafts = (nextDrafts: CalendarWriteBackDraft[]) => {
    setDrafts((current) => {
      const map = new Map(current.map((draft) => [draft.draftId, draft]));
      nextDrafts.forEach((draft) => map.set(draft.draftId, draft));
      return [...map.values()];
    });
  };

  const handleCreateTitleDrafts = () => {
    setError(undefined);
    if (invalidTasks.length === 0) {
      setMessage('形式を直す必要がある予定はありません。');
      return;
    }
    appendDrafts(invalidTasks.map((task) => createTitleNormalizeDraft(task, project)));
    setMessage(`予定名の補正候補を ${invalidTasks.length}件 作成しました。`);
  };

  const handlePlanPostpone = () => {
    setError(undefined);
    if (!selectedPostponeTask) {
      setError('遅延している予定がありません。');
      return;
    }
    const result = parsePostponeInstruction(postponePrompt, selectedPostponeTask);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPostponeDate(result.targetDate);
    setMessage(result.message);
  };

  const handleCreatePostponeDraft = () => {
    setError(undefined);
    if (!selectedPostponeTask) {
      setError('先送りする予定を選んでください。');
      return;
    }
    const result = createPostponeDraft(selectedPostponeTask, postponeDate);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    appendDrafts([result.draft]);
    setMessage('先送りの書き戻しプレビューを作成しました。');
  };

  const handleRemoveDraft = (draftId: string) => {
    setDrafts((current) => current.filter((draft) => draft.draftId !== draftId));
  };

  const handleWriteBack = async () => {
    setMessage(undefined);
    setError(undefined);
    if (drafts.length === 0) {
      setError('書き戻し前プレビューがありません。');
      return;
    }

    setIsWriting(true);
    try {
      exportCalendarWriteBackBackup(drafts);
      const authResult = await requestGoogleCalendarWriteAccessToken();
      if (!authResult.ok) {
        setError(authResult.error);
        return;
      }

      const errors: string[] = [];
      for (const draft of drafts) {
        const result = await updateCalendarEvent({
          calendarId: draft.calendarId,
          eventId: draft.googleCalendarEventId,
          accessToken: authResult.accessToken,
          patch: draft.patch,
        });
        if (!result.ok) {
          errors.push(`${draft.taskName}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        setError(errors.join('\n'));
        return;
      }

      setDrafts([]);
      setMessage('Googleカレンダーへ書き戻しました。予定を再読み込みします。');
      onWriteBackComplete();
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <section className="card calendar-maintenance-card">
      <div className="review-fix-column-heading">
        <h2>カレンダー予定の整備</h2>
        <span className="pill">書き戻し前プレビュー必須</span>
      </div>
      <p className="note">
        形式不正の予定名と遅延予定を確認し、プレビュー後にGoogleカレンダーへ反映します。OAuthトークンは保存しません。
      </p>

      <div className="calendar-maintenance-grid">
        <article className="calendar-maintenance-section">
          <h3>形式不正の予定</h3>
          <p className="meta">予定名を「担当者 / タスク名 / プロジェクト」に整えます。</p>
          {invalidTasks.length === 0 ? (
            <p className="empty-state">形式不正の予定はありません。</p>
          ) : (
            <div className="calendar-maintenance-list">
              {invalidTasks.slice(0, 5).map((task) => (
                <div key={task.taskId} className="calendar-maintenance-item">
                  <strong>{task.titleRaw}</strong>
                  <span>{task.parseError ?? 'プロジェクト未分類'}</span>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="secondary" onClick={handleCreateTitleDrafts}>
            補正候補を作る
          </button>
        </article>

        <article className="calendar-maintenance-section">
          <h3>遅延予定の先送り</h3>
          <p className="meta">自然文から日数案を作り、先送り日を指定します。</p>
          <label>
            対象予定
            <select
              value={selectedPostponeTask?.taskId ?? ''}
              onChange={(event) => setPostponeTaskId(event.target.value)}
            >
              {delayedTasks.length === 0 ? <option value="">遅延予定なし</option> : null}
              {delayedTasks.map((task) => (
                <option key={task.taskId} value={task.taskId}>
                  {task.taskName}（{formatDateTime(task.dueDate)}）
                </option>
              ))}
            </select>
          </label>
          <label>
            日数の計画
            <input
              type="text"
              value={postponePrompt}
              onChange={(event) => setPostponePrompt(event.target.value)}
              placeholder="例: 3日後にする / 1週間先へ送る"
            />
          </label>
          <div className="calendar-maintenance-actions">
            <button type="button" className="secondary" onClick={handlePlanPostpone}>日数案を作る</button>
            <label>
              先送り日
              <input
                type="date"
                value={postponeDate}
                onChange={(event) => setPostponeDate(event.target.value)}
              />
            </label>
            <button type="button" className="secondary" onClick={handleCreatePostponeDraft}>
              先送りプレビューを作る
            </button>
          </div>
        </article>
      </div>

      <div className="calendar-preview">
        <h3>書き戻し前プレビュー</h3>
        {drafts.length === 0 ? (
          <p className="empty-state">まだプレビューはありません。</p>
        ) : (
          <div className="calendar-preview-list">
            {drafts.map((draft) => (
              <article key={draft.draftId} className="calendar-preview-item">
                <div>
                  <strong>{draft.taskName}</strong>
                  <p className="meta">{reasonLabel(draft)} / {draft.projectName}</p>
                  {draft.nextSummary ? <p className="meta">予定名: {draft.previousSummary} → {draft.nextSummary}</p> : null}
                  {draft.nextStart || draft.nextEnd ? (
                    <p className="meta">
                      日時: {formatDateTime(draft.previousStart)} → {formatDateTime(draft.nextStart)}
                      {' / '}
                      {formatDateTime(draft.previousEnd)} → {formatDateTime(draft.nextEnd)}
                    </p>
                  ) : null}
                </div>
                <button type="button" className="secondary danger-outline" onClick={() => handleRemoveDraft(draft.draftId)}>
                  外す
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {message ? <p className="note">{message}</p> : null}
      {error ? <p className="error preserve-line-break">{error}</p> : null}

      <button
        type="button"
        className="primary"
        disabled={drafts.length === 0 || isWriting}
        onClick={() => void handleWriteBack()}
      >
        プレビュー内容をGoogleカレンダーへ書き戻す
      </button>
    </section>
  );
};
