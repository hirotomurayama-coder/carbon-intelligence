import type { NavItem } from "@/types/navigation";

/** アプリケーション名 */
export const APP_NAME = "Carbon Intelligence";

/** サイドナビゲーションの項目一覧 */
export const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", href: "/", icon: "dashboard" },
  {
    label: "市場データ",
    href: "/market",
    icon: "market",
    children: [
      { label: "メソドロジー", href: "/methodologies" },
      { label: "企業データベース", href: "/companies" },
      { label: "インサイト", href: "/insights" },
      { label: "政策ロードマップ", href: "/roadmap" },
    ],
  },
  { label: "分析", href: "/analysis", icon: "analytics" },
  { label: "ポートフォリオ", href: "/portfolio", icon: "portfolio" },
  { label: "設定", href: "/settings", icon: "settings" },
];
