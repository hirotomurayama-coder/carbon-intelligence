import * as cheerio from "cheerio";
import * as fs from "fs";

const html = fs.readFileSync("/tmp/jcredit-list.html", "utf8");
const $ = cheerio.load(html);

// Find all tables and inspect their structure
$("table.table-type01").each((ti, table) => {
  console.log(`=== Table ${ti} ===`);
  const headerRow = $(table).find("thead tr, tbody tr").first();
  const headerCells = headerRow.find("th, td");
  console.log("Header columns:", headerCells.length);
  headerCells.each((j, cell) => {
    console.log(`  [${j}]:`, $(cell).text().trim().slice(0, 60));
  });

  // Check 2nd row for data
  const dataRow = $(table).find("tbody tr").eq(1);
  if (dataRow.length) {
    const dataCells = dataRow.find("td");
    console.log("Data row cols:", dataCells.length);
    dataCells.each((j, cell) => {
      console.log(`  [${j}]:`, $(cell).text().trim().slice(0, 100));
    });
  }
  console.log();
});
