import { useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type SubmenuId = 'connectors' | 'plugins' | 'skills' | 'mcp' | 'import' | 'toolbox';

export function PlusSubmenuRow({
  id,
  label,
  icon,
  active,
  onOpen,
  children,
}: {
  readonly id: SubmenuId;
  readonly label: string;
  readonly icon: IconName;
  readonly active: SubmenuId | null;
  readonly onOpen: (id: SubmenuId | null, row: HTMLDivElement | null) => void;
  readonly children: ReactNode;
}) {
  const open = active === id;
  const rowRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      className={`plus-menu__submenu-row${open ? ' is-open' : ''}`}
      ref={rowRef}
      onMouseEnter={() => onOpen(id, rowRef.current)}
    >
      <button
        type="button"
        role="menuitem"
        className="plus-menu__item plus-menu__parent"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpen(open ? null : id, open ? null : rowRef.current)}
      >
        <Icon name={icon} size={15} className="plus-menu__item-icon" />
        <span>{label}</span>
        <Icon name="chevron-right" size={13} className="plus-menu__chevron" />
      </button>
      {open ? <div className="plus-menu__flyout" role="menu">{children}</div> : null}
    </div>
  );
}
