/** サイドナビゲーションの各項目の型 */
export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  children?: SubNavItem[];
};

/** サブナビゲーション項目 */
export type SubNavItem = {
  label: string;
  href: string;
  icon?: string;
};

/** ナビゲーションアイコンの種類 */
export type NavIcon =
  | "dashboard"
  | "market"
  | "analytics"
  | "statistics"
  | "library"
  | "settings";
