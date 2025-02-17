import * as fs from "fs";
import Papa from "papaparse";
import { Builder } from "xml2js";
import type { MangaEntry, CsvRow, MangaStatus } from "./types";

const DATE_FORMATS = [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{2})-(\d{2})-(\d{4})$/];

const VALID_STATUSES: Record<string, MangaStatus> = {
  Reading: "Reading",
  Completed: "Completed",
  "On-Hold": "On-Hold",
  Dropped: "Dropped",
  "Plan to Read": "Plan to Read",
};
const MAL_ID_REGEX = /manga\/(\d+)/;

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
  console.log("Building XML for", entries.length, "entries");

  const statusCounts = calculateStatusCounts(entries);
  console.log("Status counts:", statusCounts);

  const xmlObject = {
    myanimelist: {
      myinfo: {
        user_id: "123456789",
        user_name: "volx",
        user_export_type: "2",
        user_total_manga: entries.length,
        user_total_reading: statusCounts.reading || 0,
        user_total_completed: statusCounts.completed || 0,
        user_total_onhold: statusCounts.onhold || 0,
        user_total_dropped: statusCounts.dropped || 0,
        user_total_plantoread: statusCounts.plantoread || 0,
      },
      manga: entries.map((entry) => ({
        manga_mangadb_id: entry.manga_mangadb_id,
        manga_title: entry.manga_title,
        manga_volumes: entry.manga_volumes,
        manga_chapters: entry.manga_chapters,
        my_id: entry.my_id,
        my_read_volumes: entry.my_read_volumes,
        my_read_chapters: entry.my_read_chapters,
        my_start_date: entry.my_start_date,
        my_finish_date: entry.my_finish_date,
        my_scanalation_group: entry.my_scanalation_group,
        my_score: entry.my_score,
        my_storage: entry.my_storage,
        my_status: entry.my_status,
        my_comments: entry.my_comments,
        my_times_read: entry.my_times_read,
        my_tags: entry.my_tags,
        my_reread_value: entry.my_reread_value,
        update_on_import: entry.update_on_import,
      })),
    },
  };

  const builder = new Builder();
  console.log("Generating XML...");
  return builder.buildObject(xmlObject); 
}

function validateCsvRow(row: CsvRow): void {
  if (!row.mal) throw new Error("Missing 'mal' field in CSV row");
  if (!row.title) throw new Error("Missing 'title' field in CSV row");
  if (!VALID_STATUSES[row.type || ""])
    throw new Error(`Invalid status: ${row.type}`);
}

function processFile(inputCsv: string): void {
  try {
    const stream = fs.createReadStream(inputCsv);
    const results: MangaEntry[] = [];

    Papa.parse(stream, {
      header: true,
      skipEmptyLines: true,
      transform: (value: any) => value.trim().replace(/^"|"$/g, ""),
      step: (row: { data: CsvRow }) => {
        try {
          validateCsvRow(row.data);
          results.push({
            manga_mangadb_id: extractMalId(row.data.mal),
            manga_title: `<![CDATA[${row.data.title}]]>`,
            manga_volumes: "0",
            manga_chapters: "0",
            my_id: "0",
            my_read_volumes: "0",
            my_read_chapters: row.data.read || "0",
            my_start_date: parseDate(row.data.last_read),
            my_finish_date: parseDate(row.data.last_read),
            my_scanalation_group: "",
            my_score: row.data.rating || "0",
            my_storage: "",
            my_status: validateStatus(row.data.type),
            my_comments: "",
            my_times_read: "0",
            my_tags: "",
            my_reread_value: "Low",
            update_on_import: "1",
          });
        } catch (error: any) {
          console.error("Validation error for row:", row.data, error.message);
        }
      },
      complete: () => {
        try {
          console.log("Total comics:", results.length); 
          if (results.length === 0) {
            console.error("No comics to process");
            return;
          }

          const outputXml = inputCsv.replace(/\.csv$/, "_mal.xml");
          const xmlContent = buildXml(results);
          fs.writeFileSync(outputXml, xmlContent);
          console.log(`MAL XML file created successfully: ${outputXml}`);
        } catch (error) {
          console.error("Error writing XML file:", (error as Error).message);
        }
      },
    });
  } catch (error) {
    console.error("Error processing file:", (error as Error).message);
    process.exit(1);
  }
}

const inputCsv = process.argv[2];
if (!inputCsv) {
  console.error("Please provide a CSV file path");
  console.error("Usage: bun index.ts <csv-file-path>");
  process.exit(1);
}
if (!fs.existsSync(inputCsv)) {
  console.error("Error: File not found");
  process.exit(1);
}
processFile(inputCsv);
