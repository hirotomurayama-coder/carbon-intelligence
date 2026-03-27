"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Methodology, RegistryName } from "@/types";

function registryBadge(r: RegistryName) {
  switch (r) {
    case "Verra": return "emerald" as const;
    case "Gold Standard": return "amber" as const;
    case "Puro.earth": return "cyan" as const;
    default: return "gray" as const;
  }
}

function creditTypeBadge(v: string) {
  return v === "除去系" ? ("indigo" as const) : ("blue" as const);
}

function baseTypeBadge(v: string) {
  if (v === "自然ベース") return "emerald" as const;
  if (v === "技術ベース") return "slate" as const;
  return "amber" as const;
}

type CompareRow = {
  label: string;
  key: string;
  render: (m: Methodology) => React.ReactNode;
};

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "レジストリ",
    key: "registry",
    render: (m) => m.registry ? <Badge variant={registryBadge(m.registry)}>{m.registry}</Badge> : <span className="text-gray-300">—</span>,
  },
  {
    label: "クレジット種別",
    key: "creditType",
    render: (m) => m.creditType ? <Badge variant={creditTypeBadge(m.creditType)}>{m.creditType}</Badge> : <span className="text-gray-300">—</span>,
  },
  {
    label: "基本分類",
    key: "baseType",
    render: (m) => m.baseType ? <Badge variant={baseTypeBadge(m.baseType)}>{m.baseType}</Badge> : <span className="text-gray-300">—</span>,
  },
  {
    label: "詳細分類",
    key: "subCategory",
    render: (m) => <span className="text-sm text-gray-700">{m.subCategory ?? "—"}</span>,
  },
  {
    label: "発行機関（認証）",
    key: "certificationBody",
    render: (m) => <span className="text-sm text-gray-700">{m.certificationBody ?? "—"}</span>,
  },
  {
    label: "運用ステータス",
    key: "operationalStatus",
    render: (m) => {
      if (!m.operationalStatus) return <span className="text-gray-300">—</span>;
      const color = m.operationalStatus === "運用中" ? "emerald" as const : "gray" as const;
      return <Badge variant={color}>{m.operationalStatus}</Badge>;
    },
  },
  {
    label: "バージョン",
    key: "version",
    render: (m) => <span className="text-sm text-gray-700">{m.version ?? "—"}</span>,
  },
  {
    label: "AI 要約",
    key: "aiSummary",
    render: (m) => (
      <p className="text-xs leading-relaxed text-gray-600">
        {m.aiSummary ?? m.summary ?? "—"}
      </p>
    ),
  },
  {
    label: "外部更新日",
    key: "externalLastUpdated",
    render: (m) => <span className="text-sm text-gray-700">{m.externalLastUpdated ?? "—"}</span>,
  },
  {
    label: "ソースURL",
    key: "sourceUrl",
    render: (m) => m.sourceUrl ? (
      <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline break-all">
        外部ページ
      </a>
    ) : <span className="text-gray-300">—</span>,
  },
];

type Props = {
  selected: Methodology[];
  allMethodologies: Methodology[];
};

export function CompareView({ selected: initial, allMethodologies }: Props) {
  const [items, setItems] = useState<Methodology[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const addItem = (m: Methodology) => {
    if (items.length >= 3 || items.some((i) => i.id === m.id)) return;
    setItems([...items, m]);
    setShowAdd(false);
    setSearch("");
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const searchResults = useMemo(() => {
    if (!search) return [];
    const kw = search.toLowerCase();
    return allMethodologies
      .filter((m) => !items.some((i) => i.id === m.id))
      .filter((m) => {
        const target = [m.title, m.titleJa ?? "", m.registry ?? "", m.subCategory ?? ""].join(" ").toLowerCase();
        return target.includes(kw);
      })
      .slice(0, 10);
  }, [search, allMethodologies, items]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <h2 className="text-lg font-bold text-gray-900">メソドロジー比較</h2>
        <p className="mt-2 text-sm text-gray-500">
          メソドロジー一覧から比較したいアイテムを選択してください（最大3件）
        </p>
        <Link
          href="/methodologies"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
        >
          メソドロジー一覧へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">メソドロジー比較</h1>
        <span className="text-sm text-gray-400">{items.length}/3 件を比較中</span>
      </div>

      {/* 比較テーブル */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left">
          {/* ヘッダー: メソドロジー名 */}
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-36 px-5 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                項目
              </th>
              {items.map((m) => (
                <th key={m.id} className="px-5 py-4 min-w-[220px]">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/methodologies/${m.id}`} className="hover:text-emerald-600 transition">
                      <p className="text-sm font-bold text-gray-900 line-clamp-2">
                        {m.titleJa ?? m.title}
                      </p>
                      {m.titleJa && (
                        <p className="mt-0.5 text-[10px] text-gray-400 line-clamp-1">{m.title}</p>
                      )}
                    </Link>
                    <button
                      onClick={() => removeItem(m.id)}
                      className="flex-shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                      title="比較から削除"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </th>
              ))}
              {items.length < 3 && (
                <th className="px-5 py-4 min-w-[220px]">
                  {showAdd ? (
                    <div className="space-y-2">
                      <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="メソドロジーを検索..."
                      />
                      {searchResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md">
                          {searchResults.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => addItem(m)}
                              className="block w-full px-3 py-2 text-left text-xs hover:bg-emerald-50 transition"
                            >
                              <p className="font-medium text-gray-900 truncate">{m.titleJa ?? m.title}</p>
                              <p className="text-gray-400">{m.registry ?? ""} {m.subCategory ? `/ ${m.subCategory}` : ""}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => { setShowAdd(false); setSearch(""); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAdd(true)}
                      className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 px-4 py-3 text-xs text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition w-full justify-center"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      追加
                    </button>
                  )}
                </th>
              )}
            </tr>
          </thead>

          {/* 比較行 */}
          <tbody>
            {COMPARE_ROWS.map((row, ri) => {
              // 値が同じかチェック（差分ハイライト用）
              const values = items.map((m) => {
                const v = (m as Record<string, unknown>)[row.key];
                return v != null ? String(v) : null;
              });
              const allSame = values.every((v) => v === values[0]);

              return (
                <tr
                  key={row.key}
                  className={`border-b border-gray-50 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                >
                  <td className="px-5 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">
                    {row.label}
                  </td>
                  {items.map((m) => (
                    <td
                      key={m.id}
                      className={`px-5 py-3 ${!allSame && values.filter((v) => v != null).length > 1 ? "bg-amber-50/40" : ""}`}
                    >
                      {row.render(m)}
                    </td>
                  ))}
                  {items.length < 3 && <td className="px-5 py-3" />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 戻るリンク */}
      <div className="flex gap-3">
        <Link
          href="/methodologies"
          className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-emerald-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          メソドロジー一覧に戻る
        </Link>
      </div>
    </div>
  );
}
