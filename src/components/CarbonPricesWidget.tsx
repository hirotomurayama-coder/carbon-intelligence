"use client";

import { useEffect, useRef } from "react";

export function CarbonPricesWidget() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Remove any previously injected script (e.g. on hot-reload)
    const existing = ref.current.querySelector("script");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = "https://carboncredits.com/live-carbon-prices/index.js.php";
    script.async = true;
    ref.current.appendChild(script);
  }, []);

  return <div id="carbon-prices" ref={ref} className="w-full" />;
}
