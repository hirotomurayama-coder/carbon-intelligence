import type { Metadata } from "next";
import { LibraryView } from "@/components/LibraryView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ライブラリ | Carbon Intelligence",
  description:
    "社内ドキュメントのAIチャット検索。Google Driveの資料をもとに質問に回答します。",
};

export default function LibraryPage() {
  return (
    <div className="h-full">
      <LibraryView />
    </div>
  );
}
