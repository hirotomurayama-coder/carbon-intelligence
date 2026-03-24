import { getMethodologies } from "@/lib/wordpress";
import { CompareView } from "@/components/CompareView";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "メソドロジー比較 | Carbon Intelligence",
  description: "カーボンクレジットのメソドロジーを横並びで比較。レジストリ、分類、AI要約を一覧で確認。",
};

type Props = {
  searchParams: Promise<{ ids?: string }>;
};

export default async function ComparePage({ searchParams }: Props) {
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter((id) => id.trim());

  const allMethodologies = await getMethodologies();
  const selected = idList
    .map((id) => allMethodologies.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-gray-400">
        <a href="/methodologies" className="hover:text-gray-600 transition">
          メソドロジー
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">比較</span>
      </nav>

      <CompareView selected={selected} allMethodologies={allMethodologies} />
    </div>
  );
}
