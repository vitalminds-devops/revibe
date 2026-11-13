// The local model writes Markdown ("### Report", "- **Job Number:** …"); the page shows plain text.

const HEADING = /^\s*#{1,6}\s*/;

/** Report text without Markdown symbols: no #, ** or __, no --- rules, "- " bullets as "• ". */
export function plainReport(markdown: string) {
  return markdown
    .split("\n")
    .filter((line) => !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line))
    .map((line) =>
      line
        .replace(HEADING, "")
        .replace(/\*\*|__/g, "")
        .replace(/^(\s*)[-*]\s+/, "$1• "),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The paragraph under the "Summary" heading, or the first plain paragraph as a fallback. */
export function reportSummary(markdown: string) {
  const lines = markdown.split("\n");
  const start = lines.findIndex(
    (line) => HEADING.test(line) && /summary/i.test(line),
  );
  const body = start >= 0 ? lines.slice(start + 1) : lines;
  const paragraph: string[] = [];
  for (const line of body) {
    if (HEADING.test(line) || /^\s*[-*]\s/.test(line)) {
      if (paragraph.length) break;
      continue;
    }
    if (!line.trim()) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  return plainReport(paragraph.join(" "));
}
