"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";

type Notification = {
  id: string;
  title: string;
  description: string;
  registry: string;
  date: string;
  type: "new" | "updated" | "info";
};

type UpdatesResponse = {
  notifications: Notification[];
  total: number;
};

/** レジストリ名 → バッジ色 */
function registryBadge(
  registry: string
): "emerald" | "blue" | "amber" | "indigo" | "slate" {
  switch (registry) {
    case "Verra":
      return "emerald";
    case "Gold Standard":
      return "amber";
    case "Puro.earth":
      return "blue";
    case "Isometric":
      return "indigo";
    default:
      return "slate";
  }
}

/**
 * 最近の更新タイムライン。
 * /api/updates から取得した同期通知を表示する。
 */
export function UpdateTimeline() {
  const [data, setData] = useState<UpdatesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/updates")
      .then((r) => r.json())
      .then((json: UpdatesResponse) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.notifications.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          最近の更新
        </h3>
        <p className="mt-3 text-center text-xs text-gray-400">
          更新情報はまだありません
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          最近の更新
        </h3>
        {data.total > 0 && (
          <Badge variant="emerald">{data.total}件</Badge>
        )}
      </div>
      <div className="space-y-3">
        {data.notifications.slice(0, 8).map((n) => (
          <div
            key={n.id}
            className="relative border-l-2 border-emerald-200 pl-4"
          >
            {/* タイムラインドット */}
            <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-emerald-400" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={registryBadge(n.registry)}>
                  {n.registry}
                </Badge>
                {n.type === "new" && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                    New
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-medium text-gray-800 line-clamp-2">
                {n.title.replace(/【.+?】/, "").trim()}
              </p>
              <span className="text-[10px] text-gray-400">{n.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
