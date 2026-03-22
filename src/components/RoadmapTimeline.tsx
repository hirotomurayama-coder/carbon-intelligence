"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import type { RoadmapEvent, RoadmapStatus } from "@/types";

// ============================================================
// 定数
// ============================================================

const MONTH_W = 80;
const LABEL_W = 200;
const BAR_H = 30;
const LANE_H = 40;

const CATEGORY_PRIORITY: string[] = [
  "SSBJ",
  "GX-ETS",
  "J-Credit",
  "SBTi",
  "GHG Protocol",
  "CORSIA",
  "EU CBAM",
  "COP",
  "パリ協定6条",
  "TNFD",
  "ICVCM/VCMI",
  "適格カーボンクレジット",
  "カーボンプライシング",
];

const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

// ============================================================
// ヘルパー
// ============================================================

function monthIndex(dateStr: string, originYear: number, originMonth: number): number {
  const d = new Date(dateStr);
  return (d.getFullYear() - originYear) * 12 + (d.getMonth() - originMonth);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function statusBarClass(status: RoadmapStatus | null): string {
  switch (status) {
    case "完了":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "進行中":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "準備中":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "予定":
      return "bg-gray-100 text-gray-600 border-gray-300";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

function statusBadgeVariant(
  status: RoadmapStatus | null,
): "emerald" | "blue" | "amber" | "gray" {
  switch (status) {
    case "完了":
      return "emerald";
    case "進行中":
      return "blue";
    case "準備中":
      return "amber";
    default:
      return "gray";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function assignLanes(events: RoadmapEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) =>
    (a.startDate ?? "").localeCompare(b.startDate ?? ""),
  );
  const lanes: string[][] = [];
  const assignment = new Map<string, number>();

  for (const event of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const lastEnd = lanes[i][lanes[i].length - 1];
      if (lastEnd <= (event.startDate ?? "")) {
        lanes[i].push(event.endDate ?? event.startDate ?? "9999-12-31");
        assignment.set(event.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([event.endDate ?? event.startDate ?? "9999-12-31"]);
      assignment.set(event.id, lanes.length - 1);
    }
  }
  return assignment;
}

// ============================================================
// コンポーネント
// ============================================================

type Props = {
  data: RoadmapEvent[];
};

export function RoadmapTimeline({ data }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<RoadmapEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { grouped, originYear, originMonth, totalMonths, skippedCount, stats } =
    useMemo(() => {
      const withDates = data.filter((e) => e.startDate);
      const skipped = data.length - withDates.length;

      const filtered = statusFilter
        ? withDates.filter((e) => e.status === statusFilter)
        : withDates;

      const statMap: Record<string, number> = {};
      for (const e of withDates) {
        const s = e.status ?? "未設定";
        statMap[s] = (statMap[s] ?? 0) + 1;
      }

      let minDate = "9999-12-31";
      let maxDate = "0000-01-01";
      for (const e of filtered) {
        if (e.startDate && e.startDate < minDate) minDate = e.startDate;
        const end = e.endDate ?? e.startDate ?? "";
        if (end > maxDate) maxDate = end;
      }

      const oYear = filtered.length > 0 ? new Date(minDate).getFullYear() : 2023;
      const oMonth = filtered.length > 0 ? Math.floor(new Date(minDate).getMonth() / 3) * 3 : 0;
      const eDate = filtered.length > 0 ? new Date(maxDate) : new Date(2029, 0, 1);
      const totalM = Math.max(
        (eDate.getFullYear() - oYear) * 12 + (eDate.getMonth() - oMonth) + 3,
        24,
      );

      const map = new Map<string, RoadmapEvent[]>();
      for (const cat of CATEGORY_PRIORITY) {
        const items = filtered.filter((e) => e.category === cat);
        if (items.length > 0) map.set(cat, items);
      }
      const knownCats = new Set(CATEGORY_PRIORITY);
      const dynamicCats = new Set(
        filtered
          .map((e) => e.category)
          .filter((c): c is string => !!c && !knownCats.has(c)),
      );
      for (const cat of dynamicCats) {
        const items = filtered.filter((e) => e.category === cat);
        if (items.length > 0) map.set(cat, items);
      }
      const uncategorized = filtered.filter((e) => !e.category);
      if (uncategorized.length > 0) map.set("その他", uncategorized);

      return {
        grouped: map,
        originYear: oYear,
        originMonth: oMonth,
        totalMonths: totalM,
        skippedCount: skipped,
        stats: statMap,
      };
    }, [data, statusFilter]);

  // Today ライン
  const today = new Date();
  const todayMonthIdx = monthIndex(today.toISOString().slice(0, 10), originYear, originMonth);
  const todayDayFraction = (today.getDate() - 1) / daysInMonth(today.getFullYear(), today.getMonth());
  const todayLeft = LABEL_W + (todayMonthIdx + todayDayFraction) * MONTH_W;

  // ページ読み込み時に「今日」の位置が中央に来るようスクロール
  useEffect(() => {
    if (scrollRef.current && todayMonthIdx >= 0) {
      const scrollTarget = todayLeft - scrollRef.current.clientWidth / 2;
      scrollRef.current.scrollLeft = Math.max(0, scrollTarget);
    }
  }, [todayLeft, todayMonthIdx]);

  // 年ヘッダー
  const years: { year: number; startCol: number; span: number }[] = [];
  for (let m = 0; m < totalMonths; m++) {
    const currentMonth = (originMonth + m) % 12;
    const currentYear = originYear + Math.floor((originMonth + m) / 12);
    if (currentMonth === 0 || m === 0) {
      years.push({ year: currentYear, startCol: m, span: m === 0 ? 12 - originMonth : 12 });
    }
  }
  if (years.length > 0) {
    const last = years[years.length - 1];
    last.span = Math.min(last.span, totalMonths - last.startCol);
  }

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">
        ロードマップが登録されていません
      </p>
    );
  }

  if (grouped.size === 0) {
    return (
      <div className="space-y-4">
        <ControlBar statusFilter={statusFilter} onFilterChange={setStatusFilter} stats={stats} />
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">
            {skippedCount > 0
              ? `${skippedCount}件のイベントが登録されていますが、日付が未設定のためチャートに表示できません。`
              : "フィルタに一致するイベントはありません"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ControlBar statusFilter={statusFilter} onFilterChange={setStatusFilter} stats={stats} />

      {/* ガントチャート */}
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <div
          className="relative"
          style={{ minWidth: `${LABEL_W + totalMonths * MONTH_W}px` }}
        >
          {/* 年ヘッダー */}
          <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-gray-50" style={{ height: 32 }}>
            <div className="sticky left-0 z-20 shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: LABEL_W }} />
            {years.map((y) => (
              <div
                key={y.year}
                className="flex items-center justify-center border-r border-gray-100 text-xs font-bold text-gray-700"
                style={{ width: y.span * MONTH_W }}
              >
                {y.year}
              </div>
            ))}
          </div>

          {/* 月ヘッダー */}
          <div className="sticky top-8 z-10 flex border-b border-gray-200 bg-gray-50" style={{ height: 28 }}>
            <div className="sticky left-0 z-20 shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: LABEL_W }} />
            {Array.from({ length: totalMonths }).map((_, i) => {
              const mIdx = (originMonth + i) % 12;
              return (
                <div
                  key={i}
                  className="flex items-center justify-center border-r border-gray-50 text-[10px] text-gray-400"
                  style={{ width: MONTH_W }}
                >
                  {MONTH_LABELS[mIdx]}
                </div>
              );
            })}
          </div>

          {/* カテゴリ行 */}
          {Array.from(grouped.entries()).map(([category, events]) => {
            const laneMap = assignLanes(events);
            const maxLane = Math.max(...Array.from(laneMap.values()), 0);
            const rowH = (maxLane + 1) * LANE_H + 16;

            return (
              <div key={category} className="flex border-b border-gray-100" style={{ height: rowH }}>
                {/* カテゴリラベル (sticky left) */}
                <div
                  className="sticky left-0 z-20 flex shrink-0 items-start border-r border-gray-200 bg-white px-4 pt-3"
                  style={{ width: LABEL_W }}
                >
                  <span className="text-sm font-semibold text-gray-900">{category}</span>
                  <span className="ml-1.5 text-[10px] text-gray-400">{events.length}件</span>
                </div>

                {/* バー領域 */}
                <div className="relative flex-1" style={{ minWidth: totalMonths * MONTH_W }}>
                  {/* グリッド線 */}
                  {Array.from({ length: totalMonths }).map((_, i) => {
                    const mIdx = (originMonth + i) % 12;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r ${mIdx === 0 ? "border-gray-200" : "border-gray-50"}`}
                        style={{ left: i * MONTH_W, width: MONTH_W }}
                      />
                    );
                  })}

                  {/* バー（背景） + ラベル（sticky追従） */}
                  {events.map((event) => {
                    if (!event.startDate) return null;
                    const colStart = monthIndex(event.startDate, originYear, originMonth);
                    const colEnd = event.endDate ? monthIndex(event.endDate, originYear, originMonth) : colStart;
                    const lane = laneMap.get(event.id) ?? 0;
                    const barWidth = Math.max((colEnd - colStart + 1) * MONTH_W - 8, 60);
                    const barLeft = colStart * MONTH_W + 4;
                    const barTop = 8 + lane * LANE_H;

                    return (
                      <div key={event.id}>
                        {/* バー背景（クリック可能） */}
                        <button
                          type="button"
                          className={`absolute rounded-md border cursor-pointer transition-shadow hover:shadow-md ${statusBarClass(event.status)}`}
                          style={{
                            left: barLeft,
                            width: barWidth,
                            top: barTop,
                            height: BAR_H,
                          }}
                          title={`${event.title} (${formatDate(event.startDate)} ~ ${formatDate(event.endDate)})`}
                          onClick={() => setSelectedEvent(event)}
                        />
                        {/* ラベル（sticky で追従） — clip-path でバー範囲外を隠す */}
                        <div
                          className="absolute pointer-events-none"
                          style={{
                            left: barLeft,
                            width: barWidth,
                            top: barTop,
                            height: BAR_H,
                            clipPath: `inset(0 0 0 0)`,
                          }}
                        >
                          <span
                            className="sticky left-[204px] inline-flex items-center gap-1.5 whitespace-nowrap px-2 text-[11px] font-medium pointer-events-auto cursor-pointer"
                            style={{ height: BAR_H }}
                            onClick={() => setSelectedEvent(event)}
                          >
                            <span className={`${event.status === "完了" ? "text-emerald-800" : event.status === "進行中" ? "text-blue-800" : event.status === "準備中" ? "text-amber-800" : "text-gray-600"}`}>
                              {event.title}
                            </span>
                            {event.status && (
                              <span className="text-[9px] opacity-60">
                                {event.status}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Today ライン */}
          {todayMonthIdx >= 0 && todayMonthIdx < totalMonths && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-red-500"
              style={{ left: todayLeft }}
            >
              <div className="absolute top-1 left-1 whitespace-nowrap rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                今日
              </div>
            </div>
          )}
        </div>
      </div>

      {skippedCount > 0 && (
        <p className="text-xs text-gray-400">
          ※ 日付未設定のイベントが{skippedCount}件あります。
        </p>
      )}

      {/* モーダル */}
      <Modal open={selectedEvent !== null} onClose={() => setSelectedEvent(null)} title={selectedEvent?.title}>
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {selectedEvent.category && (
                <Badge variant="indigo">{selectedEvent.category}</Badge>
              )}
              {selectedEvent.status && (
                <Badge variant={statusBadgeVariant(selectedEvent.status)}>
                  {selectedEvent.status}
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {formatDate(selectedEvent.startDate)} ~ {formatDate(selectedEvent.endDate)}
            </div>
            <article
              className="prose prose-sm prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedEvent.descriptionHtml }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// コントロールバー
// ============================================================

function ControlBar({
  statusFilter,
  onFilterChange,
  stats,
}: {
  statusFilter: string;
  onFilterChange: (v: string) => void;
  stats: Record<string, number>;
}) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {/* 統計カード */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div
          className={`rounded-lg border p-3 text-center cursor-pointer transition ${
            statusFilter === "" ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "border-gray-200 bg-white hover:border-gray-300"
          }`}
          onClick={() => onFilterChange("")}
        >
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-[10px] text-gray-400">全イベント</div>
        </div>
        {(["完了", "進行中", "準備中", "予定"] as const).map((s) => (
          <div
            key={s}
            className={`rounded-lg border p-3 text-center cursor-pointer transition ${
              statusFilter === s ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
            onClick={() => onFilterChange(statusFilter === s ? "" : s)}
          >
            <div className="text-2xl font-bold text-gray-900">{stats[s] ?? 0}</div>
            <div className="flex items-center justify-center gap-1">
              <span className={`h-2 w-2 rounded-full border ${statusBarClass(s)}`} />
              <span className="text-[10px] text-gray-500">{s}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-3 w-0.5 bg-red-500 rounded" />
          今日
        </span>
        <span>|</span>
        <span>バーをクリックすると詳細が表示されます</span>
        {statusFilter && (
          <button
            onClick={() => onFilterChange("")}
            className="ml-auto rounded-full bg-gray-100 px-3 py-1 text-gray-600 hover:bg-gray-200"
          >
            × フィルタ解除
          </button>
        )}
      </div>
    </div>
  );
}
