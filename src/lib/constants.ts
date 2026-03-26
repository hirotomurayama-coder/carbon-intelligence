import type { NavItem } from "@/types/navigation";

export const APP_NAME = "Carbon Intelligence";

export const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", href: "/", icon: "dashboard" },
  {
    label: "市場データ",
    href: "/market",
    icon: "market",
    children: [
      { label: "メソドロジー", href: "/methodologies", icon: "methodology" },
      { label: "企業データベース", href: "/companies", icon: "company" },
      { label: "インサイト", href: "/insights", icon: "insight" },
      { label: "政策ロードマップ", href: "/roadmap", icon: "roadmap" },
      { label: "プロジェクト", href: "/projects", icon: "project" },
    ],
  },
  { label: "分析", href: "/analysis", icon: "analytics" },
  { label: "統計", href: "/statistics", icon: "statistics" },
  { label: "ライブラリ", href: "/library", icon: "library" },
  { label: "設定", href: "/settings", icon: "settings" },
];
