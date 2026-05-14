import { AppSidebar } from './AppSidebar';

export type CommonNavItem = {
  label: string;
  onClick: () => void;
  active?: boolean;
};

type CommonNavProps = {
  primaryItems: CommonNavItem[];
  secondaryItems?: CommonNavItem[];
  workspaceName?: string;
  projectName?: string;
};

const pickAction = (items: CommonNavItem[], patterns: string[]) =>
  items.find((item) => patterns.some((pattern) => item.label.includes(pattern)))?.onClick;

export const CommonNav = ({
  primaryItems,
  secondaryItems = [],
  workspaceName = '途切れ制作管理',
  projectName,
}: CommonNavProps) => {
  const homeAction = pickAction(secondaryItems, ['ワークスペース', 'ホーム']);
  const backupAction = pickAction(secondaryItems, ['設定', 'バックアップ']);
  const settingsAction = backupAction;

  return (
    <div className="common-nav common-nav-reference" aria-label="プロジェクト内ナビゲーション">
      <AppSidebar
        workspaceName={workspaceName}
        activeKey="project"
        calendarStatus="正本"
        onHome={homeAction}
        onProjects={homeAction}
        onCalendar={backupAction}
        onBackup={backupAction}
        onSettings={settingsAction}
      />

      <header className="project-app-header">
        <div className="project-header-context" aria-label="現在の階層">
          <span>{workspaceName}</span>
          {projectName ? (
            <>
              <span aria-hidden="true">/</span>
              <strong>{projectName}</strong>
            </>
          ) : null}
        </div>
        <div className="project-header-tools" aria-label="補助情報">
          <span className="project-sync-label">同期状態: ローカル保存</span>
          <span className="project-avatar" aria-hidden="true">PM</span>
        </div>
      </header>

      <nav className="project-tabbar" aria-label="主要画面">
        {primaryItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`project-tab ${item.active ? 'active' : ''}`}
            aria-current={item.active ? 'page' : undefined}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
