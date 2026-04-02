"use client";

import Script from "next/script";

export function CarbonPricesWidget() {
  return (
    <>
      <div id="carbon-prices" className="w-full" />
      <Script
        src="https://carboncredits.com/live-carbon-prices/index.js.php"
        strategy="afterInteractive"
      />
    </>
  );
}
