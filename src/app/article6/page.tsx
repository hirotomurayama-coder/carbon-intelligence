import type { Metadata } from "next";
import { Article6Dashboard } from "@/components/Article6Dashboard";

export const metadata: Metadata = {
  title: "Article 6 パイプライン | Carbon Intelligence",
  description:
    "パリ協定第6条（Article 6）に基づく炭素市場活動の追跡。二国間協定・JCMプロジェクト・PACM通知・CDM移行データ。UNEP-CCCデータ提供。",
};

export default function Article6Page() {
  return <Article6Dashboard />;
}
