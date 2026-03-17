import { getPriceTrendByMarketId, getPriceTrends } from "@/lib/wordpress";
import { MarketDetailView } from "@/components/MarketDetailView";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CreditMarketId } from "@/types";

export const dynamic = "force-dynamic";

const VALID_MARKET_IDS: CreditMarketId[] = [
  "eu-ets", "jcredit-energy-saving", "jcredit-forest",
  "jcredit-agri-midseason", "jcredit-agri-biochar",
  "vol-biochar", "vol-dac", "vol-erw", "vol-blue-carbon", "vol-soil-carbon",
  "vol-redd-plus", "vol-cookstoves", "vol-methane",
  "vol-nature-removal",
];

const MARKET_TITLES: Record<CreditMarketId, string> = {
  "eu-ets": "EU ETS (EUA)",
  "jcredit-energy-saving": "J-Credit（省エネルギー）",
  "jcredit-forest": "J-Credit（森林）",
  "jcredit-agri-midseason": "J-Credit（農業・中干し）",
  "jcredit-agri-biochar": "J-Credit（農業・バイオ炭）",
  "vol-biochar": "Biochar（バイオ炭除去）",
  "vol-dac": "DAC（Direct Air Capture）",
  "vol-erw": "ERW（Enhanced Rock Weathering）",
  "vol-blue-carbon": "Blue Carbon（マングローブ・海草）",
  "vol-soil-carbon": "Soil Carbon（土壌炭素貯留）",
  "vol-redd-plus": "REDD+（森林減少回避）",
  "vol-cookstoves": "Clean Cookstoves（改良かまど）",
  "vol-methane": "Methane Capture（メタン回収）",
  "vol-nature-removal": "Nature-based Removal",
};

type PageProps = {
  params: Promise<{ marketId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marketId } = await params;
  const title = MARKET_TITLES[marketId as CreditMarketId] ?? marketId;
  return {
    title: `${title} | マーケット分析 | Carbon Intelligence`,
    description: `${title}の価格動向、変動要因、AI分析による短期見通し。`,
  };
}

export default async function MarketDetailPage({ params }: PageProps) {
  const { marketId } = await params;

  if (!VALID_MARKET_IDS.includes(marketId as CreditMarketId)) {
    notFound();
  }

  const trend = await getPriceTrendByMarketId(marketId);
  if (!trend) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* パンくず */}
      <nav className="text-sm text-gray-400">
        <a href="/analysis" className="hover:text-gray-600 transition">
          マーケット・インサイト
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{trend.title}</span>
      </nav>

      <ErrorBoundary>
        <MarketDetailView trend={trend} />
      </ErrorBoundary>
    </div>
  );
}
