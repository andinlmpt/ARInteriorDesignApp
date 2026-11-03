import type { ReactNode } from 'react';

/**
 * Row action icons, drawn like the sidebar's NavIcons (24×24, 1.8 stroke), and the icon button
 * that shows them. The adviser asked for icons instead of text on table actions (2026-10-28);
 * each button keeps its words as a tooltip and as the label screen readers announce.
 */

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;

export const IconClose = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;

export const IconPause = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9v6M14 9v6" />
  </Svg>
);

/** Reinstate / restore: back to how it was. */
export const IconRestore = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.8-1.4" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Svg>
);

/** Take a product down (no longer shown in the app). */
export const IconBan = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Svg>
);

export const IconStore = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v9h16v-9" />
    <path d="M3 10l2-5h14l2 5c0 1.4-1.1 2.5-2.5 2.5S16 11.4 16 10c0 1.4-1.1 2.5-2.5 2.5S11 11.4 11 10c0 1.4-1.1 2.5-2.5 2.5S6 11.4 6 10c0 1.4-1.1 2.5-2.5 2.5" />
    <path d="M10 19v-4h4v4" />
  </Svg>
);

export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const IconArrowUp = (p: IconProps) => <Svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;

export const IconArrowDown = (p: IconProps) => <Svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>;

/** Make an admin. */
export const IconUserUp = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6 1.4 0 2.6.4 3.6 1.2" />
    <path d="M18 21v-6M15 18l3-3 3 3" />
  </Svg>
);

/** Remove admin rights. */
export const IconUserDown = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6 1.4 0 2.6.4 3.6 1.2" />
    <path d="M18 15v6M15 18l3 3 3-3" />
  </Svg>
);

type IconButtonProps = {
  /** What the button does, shown as its tooltip and read by screen readers ("Accept store"). */
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** Colours the icon: green for accepting, red for anything that removes or blocks. */
  tone?: 'default' | 'success' | 'danger';
  disabled?: boolean;
};

export function IconButton({ label, onClick, children, tone = 'default', disabled = false }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-${tone}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-tooltip={label}
    >
      {children}
    </button>
  );
}
