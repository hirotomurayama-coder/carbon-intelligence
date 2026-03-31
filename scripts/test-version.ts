import { VerraAdapter } from "../src/lib/sync/adapters/verra";

async function main() {
  const adapter = new VerraAdapter();
  const urls = [
    "https://verra.org/methodologies/vm0038-methodology-for-electric-vehicle-charging-systems-v1-0/",
    "https://verra.org/methodologies/vm0001-refrigerant-leak-detection-v1-2/",
    "https://verra.org/methodologies/vm0007-redd-methodology-framework-redd-mf-v1-6/",
    "https://verra.org/methodologies/vm0044-biochar-utilization-in-soil-and-non-soil-applications-v2-1/",
  ];

  for (const url of urls) {
    const slug = url.split("/methodologies/")[1]?.replace(/\/$/, "") ?? url;
    console.log(`\n--- ${slug} ---`);
    const result = await adapter.scrapeDetailPage(url);
    console.log("version:", result.version);
  }
}

main().catch(console.error);
