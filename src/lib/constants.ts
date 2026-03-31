import type { NavItem } from "@/types/navigation";

export const APP_NAME = "Carbon Intelligence";

export const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", href: "/", icon: "dashboard" },
  {
    label: "インサイト",
    href: "/insights",
    icon: "insight",
    children: [
      { label: "政策", href: "/insights?category=政策", icon: "insight" },
      { label: "市場", href: "/insights?category=市場", icon: "insight" },
      { label: "技術", href: "/insights?category=技術", icon: "insight" },
      { label: "週次ブリーフ", href: "/insights?category=週次ブリーフ", icon: "insight" },
    ],
  },
  { label: "メソドロジー", href: "/methodologies", icon: "methodology" },
  { label: "企業データベース", href: "/companies", icon: "company" },
  { label: "政策ロードマップ", href: "/roadmap", icon: "roadmap" },
  { label: "パリ協定6条", href: "/article6", icon: "article6" },
  { label: "カーボンクレジット価格", href: "/analysis", icon: "analytics" },
  {
    label: "統計データ",
    href: "/statistics",
    icon: "statistics",
    children: [
      { label: "概要", href: "/statistics?tab=overview" },
      { label: "発行分析", href: "/statistics?tab=issuance" },
      { label: "リタイア分析", href: "/statistics?tab=retirement" },
      { label: "メソドロジー別", href: "/statistics?tab=methodology" },
      { label: "日本市場", href: "/statistics?tab=japan" },
    ],
  },
  { label: "ライブラリ", href: "/library", icon: "library" },
  { label: "設定", href: "/settings", icon: "settings" },
];
