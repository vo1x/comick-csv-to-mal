import * as fs from "fs";
import type { MangaEntry, CsvRow, MangaStatus } from "./types";

const VALID_STATUSES: Record<string, MangaStatus> = {
  Reading: "Reading",
  Completed: "Completed",
  "On-Hold": "On-Hold",
  Dropped: "Dropped",
  "Plan to Read": "Plan to Read",
};

const MAL_ID_REGEX = /manga\/(\d+)/;
const DATE_FORMATS = [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{2})-(\d{2})-(\d{4})$/];
const QUOTE_REGEX = /^"|"$/g;

function readCsvFile(filePath: string): string[] {
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line) => line.trim());
}

function parseCsvLine(line: string): CsvRow {
  const values: string[] = [];
  const buffer: string[] = [];
  let insideQuotes = false;

  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      values.push(buffer.join("").trim());
      buffer.length = 0;
    } else {
      buffer.push(char);
    }
  }
  values.push(buffer.join("").trim());

  const [mal, title, type, read, rating, last_read] = values;
  return {
    mal,
    title: title.replace(QUOTE_REGEX, ""),
    type,
    read,
    rating,
    last_read,
  };
}

function extractMalId(url: string | undefined): string {
  const match = url?.match(MAL_ID_REGEX);
  return match?.[1] || "0";
}

function parseDate(dateStr: string | undefined): string {
  if (!dateStr) return "0000-00-00";

  for (const fmt of DATE_FORMATS) {
    const match = dateStr.match(fmt);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return "0000-00-00";
}

function validateStatus(status: string | undefined): MangaStatus {
  return VALID_STATUSES[status || ""] || "Plan to Read";
}

function calculateStatusCounts(entries: MangaEntry[]): Record<string, number> {
  return entries.reduce((acc, entry) => {
    const status = entry.my_status.toLowerCase().replace(/\s+/g, "");
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function buildXml(entries: MangaEntry[]): string {
  const statusCounts = calculateStatusCounts(entries);

  const xmlParts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<myanimelist>",
    "  <myinfo>",
    "    <user_id>123456789</user_id>",
    "    <user_name>volx</user_name>",
    "    <user_export_type>2</user_export_type>",
    `    <user_total_manga>${entries.length}</user_total_manga>`,
    `    <user_total_reading>${statusCounts.reading || 0}</user_total_reading>`,
    `    <user_total_completed>${
      statusCounts.completed || 0
    }</user_total_completed>`,
    `    <user_total_onhold>${statusCounts.onhold || 0}</user_total_onhold>`,
    `    <user_total_dropped>${statusCounts.dropped || 0}</user_total_dropped>`,
    `    <user_total_plantoread>${
      statusCounts.plantoread || 0
    }</user_total_plantoread>`,
    "  </myinfo>",
  ];

  entries.forEach((entry) => {
    xmlParts.push("  <manga>");
    Object.entries(entry).forEach(([key, value]) => {
      xmlParts.push(`    <${key}>${value}</${key}>`);
    });
    xmlParts.push("  </manga>");
  });

  xmlParts.push("</myanimelist>");
  return xmlParts.join("\n");
}

function processFile(inputCsv: string): void {
  try {
    const lines = readCsvFile(inputCsv);

    const results: MangaEntry[] = lines.slice(1).map((line) => {
      const row = parseCsvLine(line);
      return {
        manga_mangadb_id: extractMalId(row.mal),
        manga_title: `<![CDATA[${row.title}]]>`,
        manga_volumes: "0",
        manga_chapters: "0",
        my_id: "0",
        my_read_volumes: "0",
        my_read_chapters: row.read || "0",
        my_start_date: parseDate(row.last_read),
        my_finish_date: parseDate(row.last_read),
        my_scanalation_group: "",
        my_score: row.rating || "0",
        my_storage: "",
        my_status: validateStatus(row.type),
        my_comments: "",
        my_times_read: "0",
        my_tags: "",
        my_reread_value: "Low",
        update_on_import: "1",
      };
    });

    const outputXml = inputCsv.replace(/\.csv$/, "_mal.xml");
    const xmlContent = buildXml(results);
    fs.writeFileSync(outputXml, xmlContent);
    console.log(`MAL XML file created successfully: ${outputXml}`);
  } catch (error) {
    console.error("Error processing file:", (error as Error).message);
    process.exit(1);
  }
}

const inputCsv = process.argv[2];

if (!inputCsv) {
  console.error("Error: Please provide a CSV file path");
  console.error("Usage: node script.js <csv-file-path>");
  process.exit(1);
}

if (!fs.existsSync(inputCsv)) {
  console.error("Error: File not found");
  process.exit(1);
}

processFile(inputCsv);
