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

type WriteBackResult = {
  draftId: string;
  taskName: string;
  ok: boolean;
  message: string;
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
  draft.reason === 'title-normalize' ? '予定名を整える' : '予定日を先送りする';

const summarizeDraft = (draft: CalendarWriteBackDraft): string => {
  if (draft.reason === 'title-normalize') {
    return `予定名: ${draft.previousSummary} -> ${draft.nextSummary ?? '-'}`;
  }
  return `日時: ${formatDateTime(draft.previousStart)} -> ${formatDateTime(draft.nextStart)}`;
};

export const CalendarMaintenancePanel = ({ project, tasks, onWriteBackComplete }: Props) => {
  const [postponeTaskId, setPostponeTaskId] = useState('');
  const [postponePrompt, setPostponePrompt] = useState('');
  const [postponeDate, setPostponeDate] = useState('');
  const [drafts, setDrafts] = useState<CalendarWriteBackDraft[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [writeResults, setWriteResults] = useState<WriteBackResult[]>([]);
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
  const titleDraftCount = drafts.filter((draft) => draft.reason === 'title-normalize').length;
  const postponeDraftCount = drafts.filter((draft) => draft.reason === 'postpone').length;

  const appendDrafts = (nextDrafts: CalendarWriteBackDraft[]) => {
    setWriteResults([]);
    setDrafts((current) => {
      const map = new Map(current.map((draft) => [draft.draftId, draft]));
      nextDrafts.forEach((draft) => map.set(draft.draftId, draft));
      return [...map.values()];
    });
  };

  const handleCreateTitleDrafts = () => {
    setError(undefined);
    setWriteResults([]);
    if (invalidTasks.length === 0) {
      setMessage('補正が必要な予定名はありません。');
      return;
    }
    appendDrafts(invalidTasks.map((task) => createTitleNormalizeDraft(task, project)));
    setMessage(`予定名の補正候補を ${invalidTasks.length} 件作成しました。内容を確認してから書き戻してください。`);
  };

  const handlePlanPostpone = () => {
    setError(undefined);
    setWriteResults([]);
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
    setWriteResults([]);
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
    setMessage('先送りの書き戻しプレビューを作成しました。内容を確認してから書き戻してください。');
  };

  const handleRemoveDraft = (draftId: string) => {
    setWriteResults([]);
    setDrafts((current) => current.filter((draft) => draft.draftId !== draftId));
  };

  const handleWriteBack = async () => {
    setMessage(undefined);
    setError(undefined);
    setWriteResults([]);
    if (drafts.length === 0) {
      setError('書き戻し前プレビューがありません。先に補正候補または先送りプレビューを作成してください。');
      return;
    }

    setIsWriting(true);
    try {
      exportCalendarWriteBackBackup(drafts);
      const authResult = await requestGoogleCalendarWriteAccessToken();
      if (!authResult.ok) {
        setError(`Google認証に失敗しました。カレンダーには書き戻していません。\n${authResult.error}`);
        return;
      }

      const results: WriteBackResult[] = [];
      for (const draft of drafts) {
        const result = await updateCalendarEvent({
          calendarId: draft.calendarId,
          eventId: draft.googleCalendarEventId,
          accessToken: authResult.accessToken,
          patch: draft.patch,
        });
        results.push({
          draftId: draft.draftId,
          taskName: draft.taskName,
          ok: result.ok,
          message: result.ok ? '書き戻し済み' : result.error,
        });
      }

      setWriteResults(results);
      const failed = results.filter((result) => !result.ok);
      if (failed.length > 0) {
        setError(`${failed.length} 件の書き戻しに失敗しました。成功した予定もあるため、一覧で結果を確認してください。`);
        return;
      }

      setDrafts([]);
      setMessage('Googleカレンダーへ書き戻しました。復元用ファイルも保存済みです。予定を再読み込みします。');
      onWriteBackComplete();
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <section className="card calendar-maintenance-card">
      <div className="review-fix-column-heading">
        <h2>カレンダー予定の整備</h2>
        <span className="pill">書き戻し前に確認</span>
      </div>
      <p className="note">
        形式が崩れた予定名と遅延している予定を確認し、プレビュー後にGoogleカレンダーへ反映します。
        書き戻し前には復元用ファイルを書き出します。OAuthトークンは保存しません。
      </p>

      <div className="calendar-maintenance-grid">
        <article className="calendar-maintenance-section">
          <h3>形式が崩れている予定</h3>
          <p className="meta">予定名を「担当者 / タスク名 / プロジェクト」の形に整えます。</p>
          {invalidTasks.length === 0 ? (
            <p className="empty-state">形式が崩れている予定はありません。</p>
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
        <div className="calendar-preview-heading">
          <div>
            <h3>書き戻し前プレビュー</h3>
            <p className="meta">
              予定名補正 {titleDraftCount} 件 / 先送り {postponeDraftCount} 件
            </p>
          </div>
          <span className="pill">合計 {drafts.length} 件</span>
        </div>
        <p className="note">
          ここに表示されている内容だけをGoogleカレンダーへ書き戻します。実行前に復元用ファイルを自動で保存します。
        </p>
        {drafts.length === 0 ? (
          <p className="empty-state">まだプレビューはありません。</p>
        ) : (
          <div className="calendar-preview-list">
            {drafts.map((draft) => (
              <article key={draft.draftId} className="calendar-preview-item">
                <div>
                  <strong>{draft.taskName}</strong>
                  <p className="meta">{reasonLabel(draft)} / {draft.projectName}</p>
                  <p className="calendar-preview-change">{summarizeDraft(draft)}</p>
                  {draft.reason === 'postpone' ? (
                    <p className="meta">
                      終了: {formatDateTime(draft.previousEnd)} -&gt; {formatDateTime(draft.nextEnd)}
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

      {writeResults.length > 0 ? (
        <div className="calendar-write-result">
          <h3>書き戻し結果</h3>
          <div className="calendar-preview-list">
            {writeResults.map((result) => (
              <div key={result.draftId} className={`calendar-result-item ${result.ok ? 'is-success' : 'is-failed'}`}>
                <strong>{result.taskName}</strong>
                <span>{result.message}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
