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

export const CommonNav = ({
  primaryItems,
  secondaryItems = [],
  workspaceName = '途切れ制作管理',
  projectName,
}: CommonNavProps) => (
  <nav className="common-nav common-nav-layered" aria-label="プロジェクト内ナビゲーション">
    <div className="common-nav-topline">
      <div className="common-nav-brand">
        <span className="app-mark" aria-hidden="true" />
        <strong>制作PM</strong>
      </div>
      <div className="common-nav-context-row" aria-label="現在の階層">
        <span className="common-nav-context">{workspaceName}</span>
        {projectName ? (
          <>
            <span className="common-nav-separator" aria-hidden="true">/</span>
            <span className="common-nav-context">{projectName}</span>
          </>
        ) : (
          <span className="common-nav-scope">ワークスペース</span>
        )}
      </div>
      {secondaryItems.length > 0 ? (
        <div className="common-nav-secondary">
          {secondaryItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`common-nav-action ${item.active ? 'active' : ''}`}
              aria-current={item.active ? 'page' : undefined}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : <span />}
    </div>
    <div className="common-nav-primary" aria-label="主要タブ">
      {primaryItems.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`common-nav-item ${item.active ? 'active' : ''}`}
          aria-current={item.active ? 'page' : undefined}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  </nav>
);
