"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import type { GlossaryTerm } from "@/types";

type Props = {
  data: GlossaryTerm[];
};

export function GlossaryList({ data }: Props) {
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    if (keyword === "") return data;
    const lower = keyword.toLowerCase();
    return data.filter(
      (t) =>
        t.term.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower)
    );
  }, [data, keyword]);

  return (
    <div className="space-y-6">
      {/* 検索バー */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-full sm:w-72">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="用語を検索..."
          />
        </div>
        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} 語
        </span>
      </div>

      {/* 用語カード一覧 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((term) => (
          <div
            key={term.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              {term.term}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              {term.description.length > 200
                ? term.description.slice(0, 200) + "..."
                : term.description}
            </p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-gray-400">
            該当する用語が見つかりません
          </p>
        )}
      </div>
    </div>
  );
}
