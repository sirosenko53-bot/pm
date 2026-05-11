import { FormEvent, useState } from 'react';
import type { ProjectJoinSetupInput } from './projectAccessTypes';

type Props = {
  onSubmit: (
    code: string,
    setupInput: ProjectJoinSetupInput,
  ) => { ok: true; message?: string } | { ok: false; error: string };
};

export const ProjectCodeEntry = ({ onSubmit }: Props) => {
  const [projectCode, setProjectCode] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [sharedFileId, setSharedFileId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const code = projectCode.trim();
    if (!code) {
      setError('プロジェクトコードを入力してください。');
      setMessage('');
      return;
    }

    const result = onSubmit(code, {
      calendarId,
      sharedFileId,
    });
    if (!result.ok) {
      setError(result.error);
      setMessage('');
      return;
    }

    setProjectCode('');
    setError('');
    setMessage(result.message ?? '');
  };

  return (
    <main className="center">
      <div className="entry-brand">
        <span className="app-mark" aria-hidden="true" />
        <strong>制作PM</strong>
      </div>
      <section className="card entry project-code-card">
        <p className="app-title">制作PM</p>
        <h1>プロジェクトに参加する</h1>
        <div className="entry-setup-flow" aria-label="初回セットアップの流れ">
          <div>
            <span>1</span>
            <strong>コードを入力</strong>
            <p>共有されたプロジェクトコードだけを入れます。</p>
          </div>
          <div>
            <span>2</span>
            <strong>IDを入れる</strong>
            <p>持っている場合はカレンダーIDと共有ファイルIDも入れます。</p>
          </div>
          <div>
            <span>3</span>
            <strong>予定を取り込む</strong>
            <p>参加後にボタンでGoogleカレンダーを読み込みます。</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="form project-code-form">
          <label>
            プロジェクトコード
            <input
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value)}
              placeholder="tokigire-exhibition"
              autoFocus
            />
          </label>
          <fieldset className="project-code-setup-fields">
            <legend>初回設定（任意）</legend>
            <p className="note">
              共有されたIDを持っている場合だけ入力してください。未入力でもあとから設定・バックアップ画面で登録できます。
            </p>
            <label>
              GoogleカレンダーID
              <input
                value={calendarId}
                onChange={(event) => setCalendarId(event.target.value)}
                placeholder="project-calendar-id@group.calendar.google.com"
              />
            </label>
            <label>
              チーム共有ファイルID / URL
              <input
                value={sharedFileId}
                onChange={(event) => setSharedFileId(event.target.value)}
                placeholder="Google Driveの共有ファイルIDまたはURL"
              />
            </label>
          </fieldset>
          {error ? <p className="error project-code-error">{error}</p> : null}
          {message ? <p className="note">{message}</p> : null}
          <button type="submit">プロジェクトに参加する</button>
        </form>
        <div className="project-code-notes">
          <p className="note">Discordなどで共有されたプロジェクトコードを入力してください。</p>
          <p className="note">一度参加したプロジェクトはこの端末に保存されます。</p>
          <p className="note">カレンダーIDと共有ファイルIDもこの端末にだけ保存されます。</p>
          <p className="note">Googleカレンダーを正本として読み込みます。</p>
          <p className="note">ローカル保存と復元用ファイルで無課金運用します。</p>
        </div>
      </section>
    </main>
  );
};
