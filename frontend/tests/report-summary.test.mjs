import assert from "node:assert/strict";
import test from "node:test";
import { reportsPerDay, summarizeReports } from "../src/lib/report-summary.ts";

test("empty batch has no chart counts or division inputs", () => {
  assert.deepEqual(summarizeReports([]), {
    total: 0, recorded: 0, categories: [], issues: [],
    rectification: [{ label: "Time recorded", count: 0 }, { label: "Time not recorded", count: 0 }],
  });
});

test("charts count each screenshot, group casing and include missing fields", () => {
  const summary = summarizeReports([
    { fields: { category: " Repair ", issue_type: "High  loss", done_rectification: "12:00 PM" }, report: "A" },
    { fields: { category: "repair", issue_type: "high loss", done_rectification: "N/A" }, report: "B" },
    { fields: {}, report: "C" },
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.recorded, 1);
  assert.deepEqual(summary.categories, [{ label: "Repair", count: 2 }, { label: "Not recorded", count: 1 }]);
  assert.deepEqual(summary.issues, [{ label: "High loss", count: 2 }, { label: "Not recorded", count: 1 }]);
  assert.deepEqual(summary.rectification, [{ label: "Time recorded", count: 1 }, { label: "Time not recorded", count: 2 }]);
  for (const chart of [summary.categories, summary.issues, summary.rectification]) {
    assert.equal(chart.reduce((sum, row) => sum + row.count, 0), summary.total);
  }
});

test("reports per day fills gaps with zero", () => {
  assert.deepEqual(reportsPerDay([]), []);
  assert.deepEqual(reportsPerDay(["2026-11-03T10:00", "2026-11-01T09:00", "2026-11-01T15:00"]), [
    { label: "2026-11-01", count: 2 }, { label: "2026-11-02", count: 0 }, { label: "2026-11-03", count: 1 },
  ]);
});
