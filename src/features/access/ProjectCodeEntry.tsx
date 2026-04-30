import { FormEvent, useState } from 'react';

type Props = {
  onSubmit: (code: string) => { ok: true; message?: string } | { ok: false; error: string };
};

export const ProjectCodeEntry = ({ onSubmit }: Props) => {
  const [projectCode, setProjectCode] = useState('');
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
      <section className="card entry project-code-card">
        <p className="app-title">制作PM</p>
        <h1>プロジェクトに参加する</h1>
        <form onSubmit={handleSubmit} className="form project-code-form">
          <label>
            プロジェクトコード
            <input
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value)}
              placeholder="tokigire-exhibition"
            />
          </label>
          {error ? <p className="error project-code-error">{error}</p> : null}
          {message ? <p className="note">{message}</p> : null}
          <button type="submit">プロジェクトに参加する</button>
        </form>
        <div className="project-code-notes">
          <p className="note">Discordなどで共有されたプロジェクトコードを入力してください。</p>
          <p className="note">一度参加したプロジェクトはこの端末に保存されます。</p>
          <p className="note">次回以降は参加中プロジェクト一覧から開けます。</p>
          <p className="note">Googleカレンダーを正本として読み込みます。</p>
          <p className="note">ローカル保存とJSONバックアップで無課金運用します。</p>
        </div>
      </section>
    </main>
  );
};
