export type ReportResult = { fields: Record<string, string>; report: string };
export type ChartCount = { label: string; count: number };

function counts(reports: ReportResult[], field: string): ChartCount[] {
  const groups = new Map<string, ChartCount>();
  for (const { fields } of reports) {
    const label = fields[field]?.trim().replace(/\s+/g, " ") || "Not recorded";
    const key = label.toLowerCase();
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { label, count: 1 });
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

export function summarizeReports(reports: ReportResult[]) {
  const recorded = reports.filter(({ fields }) => {
    const value = fields.done_rectification?.trim() || "";
    return value !== "" && !/^(?:-+|n\/?a|none|not recorded)$/i.test(value);
  }).length;
  return {
    total: reports.length,
    recorded,
    categories: counts(reports, "category"),
    issues: counts(reports, "issue_type"),
    rectification: [
      { label: "Time recorded", count: recorded },
      { label: "Time not recorded", count: reports.length - recorded },
    ],
  };
}

// Every day from the first to the last capture, so quiet days show as zero on the line.
export function reportsPerDay(dates: string[]): ChartCount[] {
  const days = new Map<string, number>();
  for (const date of dates) {
    const day = new Date(date).toLocaleDateString("en-CA");
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  const sorted = [...days.keys()].sort();
  if (!sorted.length) return [];
  const result: ChartCount[] = [];
  for (
    const day = new Date(`${sorted[0]}T00:00`);
    ;
    day.setDate(day.getDate() + 1)
  ) {
    const label = day.toLocaleDateString("en-CA");
    result.push({ label, count: days.get(label) ?? 0 });
    if (label === sorted.at(-1)) return result;
  }
}
