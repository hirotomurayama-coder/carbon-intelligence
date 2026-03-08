import type { NavItem } from "@/types/navigation";

/** アプリケーション名 */
export const APP_NAME = "Carbon Intelligence";

/** サイドナビゲーションの項目一覧 */
export const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", href: "/", icon: "dashboard" },
  {
    label: "ニュース",
    href: "/news",
    icon: "market",
    children: [
      { label: "国内ニュース", href: "/news?cat=1" },
      { label: "海外ニュース", href: "/news?cat=29" },
      { label: "コラム", href: "/news?cat=2" },
      { label: "オフセット事例", href: "/news?cat=51" },
    ],
  },
  { label: "用語集", href: "/glossary", icon: "analytics" },
  { label: "設定", href: "/settings", icon: "settings" },
];
