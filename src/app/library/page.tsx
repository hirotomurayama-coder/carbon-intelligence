import type { Metadata } from "next";
import { LibraryView } from "@/components/LibraryView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ライブラリ | Carbon Intelligence",
  description:
    "Google Driveの社内ドキュメントをキーワード検索。関連資料をレコメンド表示します。",
};

export default function LibraryPage() {
  return (
    <div className="h-full">
      <LibraryView />
    </div>
  );
}
