"use client";

export function CarbonPricesWidget() {
  return (
    <iframe
      src="https://carboncredits.com/live-carbon-prices/"
      className="w-full border-0"
      style={{ height: "420px" }}
      title="Live Carbon Prices"
      loading="lazy"
    />
  );
}
