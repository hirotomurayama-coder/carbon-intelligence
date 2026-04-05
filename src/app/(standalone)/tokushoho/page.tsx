import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | Carbon Intelligence",
};

const ROWS = [
  { label: "販売事業者", content: "株式会社クレイドルトゥー" },
  { label: "運営責任者", content: "村山大翔" },
  {
    label: "所在地",
    content: (
      <>
        〒810-0001<br />
        福岡県福岡市中央区天神1丁目1番1号<br />
        アクロス福岡1階 fabbit GGアクロス福岡
      </>
    ),
  },
  {
    label: "電話番号",
    content: (
      <>
        092-600-0563<br />
        <span className="text-xs text-gray-400">受付時間：10:00〜18:00（土日祝日を除く）</span>
      </>
    ),
  },
  { label: "メールアドレス", content: "info@cradleto.com" },
  { label: "販売URL", content: "https://intelligence.carboncredits.jp" },
  { label: "販売価格", content: "月額 5,000円（税込）" },
  { label: "商品代金以外の必要料金", content: "なし" },
  {
    label: "お支払い方法",
    content: "クレジットカード（VISA / Mastercard / JCB / American Express）",
  },
  {
    label: "お支払い時期",
    content:
      "初回はお申し込み時に即時決済されます。以降、毎月の契約更新日に自動的にクレジットカードへ請求されます。",
  },
  {
    label: "サービス提供時期",
    content: "決済完了後、即時ご利用いただけます。",
  },
  {
    label: "解約について",
    content: "マイページよりいつでも解約手続きが可能です。次回更新日の前日までに解約手続きを完了した場合、翌月以降の料金は発生しません。解約後も、当該請求期間の末日までサービスをご利用いただけます。",
  },
  {
    label: "返品・返金について",
    content: (
      <>
        <p>〈通常時（サービスに問題がない場合）〉本サービスはデジタルコンテンツの継続提供であるため、お申し込み後の返金は原則として承っておりません。ただし、初回決済後7日以内にご連絡いただいた場合は、ご利用状況を確認のうえ、個別に対応いたします。解約後の残存期間分の返金は行っておりません。ご不明な点はお申し込み前にinfo@cradleto.comまでお問い合わせください。</p>
        <p className="mt-3">〈サービスに重大な瑕疵があった場合〉システム障害・データ欠損・機能不全など、弊社の責に帰すべき重大な瑕疵が認められる場合は、お問い合わせ窓口（info@cradleto.com）までご連絡ください。状況を調査のうえ、該当期間分の返金または次月無償提供などの適切な補償対応をいたします。</p>
      </>
    ),
  },
  {
    label: "動作環境",
    content: (
      <>
        <p>以下のブラウザの最新版を推奨します。</p>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-500">
          <li>Google Chrome</li>
          <li>Microsoft Edge</li>
          <li>Safari</li>
          <li>Firefox</li>
        </ul>
      </>
    ),
  },
];

export default function TokushohoPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <h1 className="mb-10 border-b-2 border-gray-900 pb-4 text-xl font-bold tracking-wide text-gray-900 md:text-2xl">
          特定商取引法に基づく表記
        </h1>

        <table className="w-full border-collapse">
          <tbody>
            {ROWS.map(({ label, content }) => (
              <tr key={label} className="border-b border-gray-200 last:border-b-0">
                <th className="w-40 py-4 pr-6 text-left align-top text-sm font-semibold whitespace-nowrap text-gray-700 md:w-44">
                  {label}
                </th>
                <td className="py-4 text-sm leading-relaxed text-gray-600">
                  {content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
