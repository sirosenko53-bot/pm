export type AppSidebarKey = 'home' | 'project' | 'calendar' | 'backup' | 'settings';

type AppSidebarProps = {
  workspaceName?: string;
  activeKey?: AppSidebarKey;
  calendarStatus?: string;
  lastUpdatedText?: string;
  onHome?: () => void;
  onProjects?: () => void;
  onCalendar?: () => void;
  onBackup?: () => void;
  onSettings?: () => void;
};

type SidebarItem = {
  key: AppSidebarKey;
  label: string;
  description: string;
  icon: string;
  onClick?: () => void;
};

export const AppSidebar = ({
  workspaceName = '途切れ制作管理',
  activeKey = 'home',
  calendarStatus = '未読み込み',
  lastUpdatedText,
  onHome,
  onProjects,
  onCalendar,
  onBackup,
  onSettings,
}: AppSidebarProps) => {
  const items: SidebarItem[] = [
    { key: 'home', label: 'ホーム', description: 'ワークスペース全体へ戻る', icon: '⌂', onClick: onHome },
    { key: 'project', label: 'プロジェクト一覧', description: '参加中プロジェクトを選ぶ', icon: '□', onClick: onProjects },
    { key: 'calendar', label: 'カレンダー連携', description: 'Google接続と取り込み設定', icon: '◷', onClick: onCalendar },
    { key: 'backup', label: 'バックアップ', description: '復元用ファイルの保存・読込', icon: '⇩', onClick: onBackup },
    { key: 'settings', label: '設定・同期', description: '共有ファイルと担当者設定', icon: '⚙', onClick: onSettings },
  ];

  return (
    <aside className="app-sidebar" aria-label="アプリ全体のナビゲーション">
      <div className="app-side-brand">
        <span className="app-mark" aria-hidden="true" />
        <strong>制作PM</strong>
      </div>

      <div className="app-side-section">
        <p className="app-side-label">ワークスペース</p>
        <div className="app-side-select" title={workspaceName}>
          <span>{workspaceName}</span>
          <span aria-hidden="true">⌄</span>
        </div>
      </div>

      <nav className="app-side-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-side-nav-item ${activeKey === item.key ? 'active' : ''}`}
            aria-current={activeKey === item.key ? 'page' : undefined}
            onClick={item.onClick}
            disabled={!item.onClick}
            title={item.description}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="app-side-nav-text">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="app-side-status">
        <strong>同期状況</strong>
        <p><span className="status-dot" aria-hidden="true" />Googleカレンダー: {calendarStatus}</p>
        <p><span className="status-dot" aria-hidden="true" />ローカル保存</p>
        <p>{lastUpdatedText ? `最終同期: ${lastUpdatedText}` : '最終同期: 未記録'}</p>
        {onBackup ? (
          <button type="button" className="app-side-status-button" onClick={onBackup}>
            状態を確認
          </button>
        ) : null}
      </div>
    </aside>
  );
};
