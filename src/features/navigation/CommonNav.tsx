export type CommonNavItem = {
  label: string;
  onClick: () => void;
  active?: boolean;
};

type CommonNavProps = {
  primaryItems: CommonNavItem[];
  secondaryItems?: CommonNavItem[];
};

export const CommonNav = ({ primaryItems, secondaryItems = [] }: CommonNavProps) => (
  <nav className="common-nav" aria-label="プロジェクト内ナビゲーション">
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
