import { FormEvent, useState } from 'react';

type Props = { onSubmit: (code: string) => boolean };

export const WorkspaceCodeScreen = ({ onSubmit }: Props) => {
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceCode.trim()) {
      setError('ワークスペースコードを入力してください。');
      return;
    }
    if (!onSubmit(workspaceCode)) {
      setError('ワークスペースコードが見つかりません。');
      return;
    }
    setError('');
  };

  return (
    <main className="center">
      <section className="card entry">
        <p className="app-title">制作PM</p>
        <h1>ワークスペースに入る</h1>
        <form onSubmit={handleSubmit} className="form">
          <input
            value={workspaceCode}
            onChange={(event) => setWorkspaceCode(event.target.value)}
            placeholder="tokigire"
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">ワークスペースに入る</button>
        </form>
        <p className="note">Googleカレンダーを正本として読み込みます</p>
        <p className="note">ローカル保存と復元用ファイルで無料運用します</p>
      </section>
    </main>
  );
};
