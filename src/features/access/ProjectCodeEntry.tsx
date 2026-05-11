import { FormEvent, useState } from 'react';

type Props = {
  calendarAuthStatus: string;
  calendarStatus: string;
  isConnectingGoogle: boolean;
  isMockMode: boolean;
  onConnectGoogleCalendar: () => void;
  onSubmit: (code: string) => { ok: true; message?: string } | { ok: false; error: string };
};

export const ProjectCodeEntry = ({
  calendarAuthStatus,
  calendarStatus,
  isConnectingGoogle,
  isMockMode,
  onConnectGoogleCalendar,
  onSubmit,
}: Props) => {
  const [projectCode, setProjectCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canSubmitProjectCode = isMockMode || calendarAuthStatus.startsWith('接続済み');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitProjectCode) {
      setError('先にGoogleアカウントで接続してください。');
      setMessage('');
      return;
    }

    const code = projectCode.trim();
    if (!code) {
      setError('プロジェクトコードを入力してください。');
      setMessage('');
      return;
    }

    const result = onSubmit(code);
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
            <strong>Googleに接続</strong>
            <p>カレンダーを読めるアカウントで、予定の読み込みと修正を許可します。</p>
          </div>
          <div>
            <span>2</span>
            <strong>コードを入力</strong>
            <p>共有されたプロジェクトコードだけを入れます。</p>
          </div>
          <div>
            <span>3</span>
            <strong>予定を見る</strong>
            <p>参加後、登録済みカレンダーから予定を取り込みます。</p>
          </div>
        </div>
        <div className="entry-google-connect">
          <div>
            <strong>Googleアカウント接続</strong>
            <p>
              カレンダーIDはアプリ側で管理します。最初に、対象カレンダーを閲覧・編集できるGoogleアカウントで許可してください。
              トークンは保存しません。
            </p>
            <p className="meta">接続状態: {calendarAuthStatus} / 予定表示: {calendarStatus}</p>
          </div>
          <button
            type="button"
            className="setup-step-action primary-lite"
            onClick={onConnectGoogleCalendar}
            disabled={isConnectingGoogle || isMockMode}
          >
            {isConnectingGoogle ? '接続中' : 'Googleアカウントで接続'}
          </button>
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
          {!canSubmitProjectCode ? (
            <p className="note">Google接続後にプロジェクトコードを入力できます。</p>
          ) : null}
          {error ? <p className="error project-code-error">{error}</p> : null}
          {message ? <p className="note">{message}</p> : null}
          <button type="submit" disabled={!canSubmitProjectCode}>プロジェクトに参加する</button>
        </form>
        <div className="project-code-notes">
          <p className="note">Discordなどで共有されたプロジェクトコードを入力してください。</p>
          <p className="note">一度参加したプロジェクトはこの端末に保存されます。</p>
          <p className="note">カレンダーIDはプロジェクト定義側で管理します。</p>
          <p className="note">Googleカレンダーを正本として読み込みます。</p>
          <p className="note">ローカル保存と復元用ファイルで無課金運用します。</p>
        </div>
      </section>
    </main>
  );
};
