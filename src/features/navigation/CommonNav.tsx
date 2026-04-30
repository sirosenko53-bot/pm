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
  <nav className="common-nav" aria-label="プロジェクト内ナビゲーション">
    <div className="common-nav-brand">
      <span className="app-mark" aria-hidden="true" />
      <strong>制作PM</strong>
    </div>
    <div className="common-nav-center">
      <div className="common-nav-context-row">
        <span className="common-nav-context">{workspaceName}</span>
        {projectName ? (
          <>
            <span className="common-nav-separator" aria-hidden="true">/</span>
            <span className="common-nav-context">{projectName}</span>
          </>
        ) : null}
      </div>
      <div className="common-nav-primary">
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
    ) : null}
  </nav>
);
