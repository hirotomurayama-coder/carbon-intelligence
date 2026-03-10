"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import type { RoadmapEvent, RoadmapStatus, RoadmapCategory } from "@/types";

// ============================================================
// 定数
// ============================================================

/** 月カラム幅 (px) */
const MONTH_W = 80;
/** カテゴリラベル列幅 (px) */
const LABEL_W = 200;
/** バーの高さ (px) */
const BAR_H = 28;
/** バー間のパディング (px) */
const LANE_H = 36;

/** カテゴリの表示順序 */
const CATEGORY_ORDER: RoadmapCategory[] = [
  "SSBJ",
  "GX-ETS",
  "TNFD",
  "J-Credit",
  "適格カーボンクレジット",
  "カーボンプライシング",
];

/** 月名 (短縮) */
const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

// ============================================================
// ヘルパー
// ============================================================

/** 日付文字列から月インデックス (originYear/originMonth からの月数) を算出 */
function monthIndex(dateStr: string, originYear: number, originMonth: number): number {
  const d = new Date(dateStr);
  return (d.getFullYear() - originYear) * 12 + (d.getMonth() - originMonth);
}

/** 月の日数 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** ステータスに応じたバー色 */
function statusBarClass(status: RoadmapStatus | null): string {
  switch (status) {
    case "完了":
      return "bg-emerald-200 text-emerald-800 border-emerald-300";
    case "進行中":
      return "bg-blue-200 text-blue-800 border-blue-300";
    case "準備中":
      return "bg-amber-200 text-amber-800 border-amber-300";
    case "予定":
      return "bg-gray-200 text-gray-700 border-gray-300";
    default:
      return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

/** ステータスに応じた Badge variant */
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

/** 日付フォーマット */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/**
 * 同一カテゴリ内のイベントにレーン番号 (y方向のオフセット) を割り当てる。
 * 重なりを避けるグリーディ区間スケジューリング。
 */
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

  const { grouped, originYear, originMonth, totalMonths, skippedCount } =
    useMemo(() => {
      // 日付のあるイベントのみガントチャートに表示
      const withDates = data.filter((e) => e.startDate);
      const skipped = data.length - withDates.length;

      // ステータスフィルタ
      const filtered = statusFilter
        ? withDates.filter((e) => e.status === statusFilter)
        : withDates;

      // タイムライン範囲の算出
      let minDate = "9999-12-31";
      let maxDate = "0000-01-01";
      for (const e of filtered) {
        if (e.startDate && e.startDate < minDate) minDate = e.startDate;
        const end = e.endDate ?? e.startDate ?? "";
        if (end > maxDate) maxDate = end;
      }

      // デフォルト範囲 (データがない場合は 2023-01 〜 2029-01)
      const oYear =
        filtered.length > 0 ? new Date(minDate).getFullYear() : 2023;
      const oMonth =
        filtered.length > 0
          ? Math.floor(new Date(minDate).getMonth() / 3) * 3
          : 0;
      const eDate =
        filtered.length > 0 ? new Date(maxDate) : new Date(2029, 0, 1);
      const totalM = Math.max(
        (eDate.getFullYear() - oYear) * 12 + (eDate.getMonth() - oMonth) + 3,
        24,
      );

      // event_category でグループ化 (定義順)
      const map = new Map<string, RoadmapEvent[]>();
      for (const cat of CATEGORY_ORDER) {
        const items = filtered.filter((e) => e.category === cat);
        if (items.length > 0) map.set(cat, items);
      }
      // 未分類
      const uncategorized = filtered.filter(
        (e) => !e.category || !CATEGORY_ORDER.includes(e.category),
      );
      if (uncategorized.length > 0) map.set("その他", uncategorized);

      return {
        grouped: map,
        originYear: oYear,
        originMonth: oMonth,
        totalMonths: totalM,
        skippedCount: skipped,
      };
    }, [data, statusFilter]);

  // Today ラインの位置
  const today = new Date();
  const todayMonthIdx = monthIndex(
    today.toISOString().slice(0, 10),
    originYear,
    originMonth,
  );
  const todayDayFraction =
    (today.getDate() - 1) /
    daysInMonth(today.getFullYear(), today.getMonth());
  const todayLeft = LABEL_W + (todayMonthIdx + todayDayFraction) * MONTH_W;

  // 年ヘッダーの構築
  const years: { year: number; startCol: number; span: number }[] = [];
  for (let m = 0; m < totalMonths; m++) {
    const currentMonth = (originMonth + m) % 12;
    const currentYear = originYear + Math.floor((originMonth + m) / 12);
    if (currentMonth === 0 || m === 0) {
      years.push({
        year: currentYear,
        startCol: m,
        span: m === 0 ? 12 - originMonth : 12,
      });
    }
  }
  if (years.length > 0) {
    const last = years[years.length - 1];
    last.span = Math.min(last.span, totalMonths - last.startCol);
  }

  // ----- データが 0 件の場合 -----
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">
        ロードマップが登録されていません
      </p>
    );
  }

  // ----- 日付入りイベントが 0 件の場合 -----
  if (grouped.size === 0) {
    return (
      <div className="space-y-4">
        {/* コントロールバーは表示しておく */}
        <ControlBar
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />

        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">
            {skippedCount > 0 ? (
              <>
                {skippedCount}件のイベントが登録されていますが、
                <br />
                ACF の日付フィールド（<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">start_date</code>
                ・<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">end_date</code>）が
                未設定のためチャートに表示できません。
                <br />
                <span className="mt-2 block text-xs text-gray-400">
                  WordPress 管理画面で roadmap CPT の ACF フィールドグループを作成し、
                  各投稿に日付を入力してください。
                </span>
              </>
            ) : (
              "フィルタに一致するイベントはありません"
            )}
          </p>
        </div>
      </div>
    );
  }

  // ----- ガントチャート描画 -----
  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <ControlBar
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* ガントチャート */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div
          className="relative"
          style={{ minWidth: `${LABEL_W + totalMonths * MONTH_W}px` }}
        >
          {/* ===== 年ヘッダー (sticky top) ===== */}
          <div
            className="sticky top-0 z-10 flex border-b border-gray-200 bg-gray-50"
            style={{ height: 32 }}
          >
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-gray-200 bg-gray-50"
              style={{ width: LABEL_W }}
            />
            {years.map((y) => (
              <div
                key={y.year}
                className="flex items-center justify-center border-r border-gray-100 text-xs font-semibold text-gray-600"
                style={{ width: y.span * MONTH_W }}
              >
                {y.year}
              </div>
            ))}
          </div>

          {/* ===== 月ヘッダー (sticky top) ===== */}
          <div
            className="sticky top-8 z-10 flex border-b border-gray-200 bg-gray-50"
            style={{ height: 28 }}
          >
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-gray-200 bg-gray-50"
              style={{ width: LABEL_W }}
            />
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

          {/* ===== カテゴリ行 (event_category ごと) ===== */}
          {Array.from(grouped.entries()).map(([category, events]) => {
            const laneMap = assignLanes(events);
            const maxLane = Math.max(...Array.from(laneMap.values()), 0);
            const rowH = (maxLane + 1) * LANE_H + 16;

            return (
              <div
                key={category}
                className="flex border-b border-gray-100"
                style={{ height: rowH }}
              >
                {/* カテゴリラベル (sticky left) */}
                <div
                  className="sticky left-0 z-20 flex shrink-0 items-start border-r border-gray-200 bg-white px-4 pt-3"
                  style={{ width: LABEL_W }}
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {category}
                  </span>
                </div>

                {/* イベントバー領域 */}
                <div
                  className="relative flex-1"
                  style={{ minWidth: totalMonths * MONTH_W }}
                >
                  {/* グリッド背景線 */}
                  {Array.from({ length: totalMonths }).map((_, i) => {
                    const mIdx = (originMonth + i) % 12;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r ${
                          mIdx === 0 ? "border-gray-200" : "border-gray-50"
                        }`}
                        style={{ left: i * MONTH_W, width: MONTH_W }}
                      />
                    );
                  })}

                  {/* イベントバー — start_date / end_date 基準で描画 */}
                  {events.map((event) => {
                    if (!event.startDate) return null;
                    const colStart = monthIndex(
                      event.startDate,
                      originYear,
                      originMonth,
                    );
                    const colEnd = event.endDate
                      ? monthIndex(event.endDate, originYear, originMonth)
                      : colStart;
                    const lane = laneMap.get(event.id) ?? 0;
                    const barWidth = Math.max(
                      (colEnd - colStart + 1) * MONTH_W - 8,
                      40,
                    );

                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={`absolute flex items-center rounded-full border px-3 text-xs font-medium truncate cursor-pointer transition-opacity hover:opacity-80 ${statusBarClass(event.status)}`}
                        style={{
                          left: colStart * MONTH_W + 4,
                          width: barWidth,
                          top: 8 + lane * LANE_H,
                          height: BAR_H,
                        }}
                        title={`${event.title} (${formatDate(event.startDate)} ~ ${formatDate(event.endDate)})`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        {event.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ===== Today ライン (赤い縦線) ===== */}
          {todayMonthIdx >= 0 && todayMonthIdx < totalMonths && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-red-500"
              style={{ left: todayLeft }}
            >
              <div className="absolute top-1 left-1 whitespace-nowrap rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                今日
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 日付なしイベントの注釈 (あれば) */}
      {skippedCount > 0 && (
        <p className="text-xs text-gray-400">
          ※ 日付（ACF）未設定のイベントが{skippedCount}件あります。
          WordPress 管理画面で start_date / end_date を入力するとチャートに表示されます。
        </p>
      )}

      {/* ===== 詳細モーダル ===== */}
      <Modal
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title}
      >
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
              {formatDate(selectedEvent.startDate)} 〜{" "}
              {formatDate(selectedEvent.endDate)}
            </div>
            <article
              className="prose prose-sm prose-gray max-w-none"
              dangerouslySetInnerHTML={{
                __html: selectedEvent.descriptionHtml,
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// サブコンポーネント: コントロールバー (フィルタ + 凡例)
// ============================================================

function ControlBar({
  statusFilter,
  onFilterChange,
}: {
  statusFilter: string;
  onFilterChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <select
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        value={statusFilter}
        onChange={(e) => onFilterChange(e.target.value)}
      >
        <option value="">すべてのステータス</option>
        <option value="完了">完了</option>
        <option value="進行中">進行中</option>
        <option value="準備中">準備中</option>
        <option value="予定">予定</option>
      </select>

      {/* 凡例 */}
      <div className="ml-auto flex items-center gap-3">
        {(["完了", "進行中", "準備中", "予定"] as RoadmapStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={`h-3 w-3 rounded-full border ${statusBarClass(s)}`}
            />
            <span className="text-xs text-gray-500">{s}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-red-500" />
          <span className="text-xs text-gray-500">今日</span>
        </div>
      </div>
    </div>
  );
}
