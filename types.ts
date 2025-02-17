export type MangaStatus =
  | "Reading"
  | "Completed"
  | "On-Hold"
  | "Dropped"
  | "Plan to Read";

export interface MangaEntry {
  manga_mangadb_id: string;
  manga_title: string;
  manga_volumes: string;
  manga_chapters: string;
  my_id: string;
  my_read_volumes: string;
  my_read_chapters: string;
  my_start_date: string;
  my_finish_date: string;
  my_scanalation_group: string;
  my_score: string;
  my_storage: string;
  my_status: string;
  my_comments: string;
  my_times_read: string;
  my_tags: string;
  my_reread_value: string;
  update_on_import: string;
}

export interface CsvRow {
  mal?: string;
  title: string;
  type?: string;
  read?: string;
  rating?: string;
  last_read?: string;
}
