"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownToLine, ShieldCheck } from "lucide-react";
import { plainReport, reportSummary } from "@/lib/report-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import type { ReadyShot } from "@/lib/api";
import {
  reportsPerDay,
  type ChartCount,
  type summarizeReports,
} from "@/lib/report-summary";

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];
const AXIS = { fontSize: 12, fill: "var(--foreground)" };

// Pie slices beyond the palette fold into "Other" instead of reusing a color.
function topWithOther(counts: ChartCount[]): ChartCount[] {
  if (counts.length <= SERIES.length) return counts;
  const rest = counts
    .slice(SERIES.length - 1)
    .reduce((sum, row) => sum + row.count, 0);
  return [
    ...counts.slice(0, SERIES.length - 1),
    { label: "Other", count: rest },
  ];
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactElement;
}) {
  return (
    <Card className="chart-card gap-3 shadow-none">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function Donut({ data }: { data: ChartCount[] }) {
  return (
    <PieChart>
      <Pie
        data={data}
        dataKey="count"
        nameKey="label"
        innerRadius="55%"
        outerRadius="80%"
        stroke="var(--card)"
        strokeWidth={4}
        isAnimationActive={false}
      >
        {data.map((row, i) => (
          <Cell key={row.label} fill={SERIES[i]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend />
    </PieChart>
  );
}

// The facts a reviewer checks first, in reading order; empty ones are left out.
function keyFacts(f: Record<string, string>): [string, string][] {
  const times = [
    f.arrival && `arrived ${f.arrival}`,
    f.departure && `left ${f.departure}`,
    f.done_rectification && `done ${f.done_rectification}`,
  ].filter(Boolean);
  const facts: [string, string | undefined][] = [
    ["Issue", f.issue_type],
    ["Location", [f.location, f.street_address].filter(Boolean).join(", ")],
    ["NAP code", f.nap_code],
    ["Time", times.join(" · ")],
    ["Cause", f.rfo],
    ["Action taken", f.action_taken],
  ];
  return facts.filter((fact): fact is [string, string] => !!fact[1]?.trim());
}

function ReportCard({ shot }: { shot: ReadyShot }) {
  const f = shot.fields;
  const people = [f.technician, f.team && `Team ${f.team}`]
    .filter(Boolean)
    .join(" · ");
  const summary = reportSummary(shot.report);
  return (
    <li className="report-card">
      <header>
        <div>
          <h4>{f.jo_number || `Report #${shot.id}`}</h4>
          <p>
            {[people, new Date(shot.created_at).toLocaleString()]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="report-tags">
          {[f.category, f.service_type].filter(Boolean).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </span>
      </header>
      <dl className="report-facts">
        {keyFacts(f).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {summary && <p className="report-summary">{summary}</p>}
      <details className="report-full">
        <summary>Full report and all fields</summary>
        <p className="report-full-text">{plainReport(shot.report)}</p>
        <table className="extracted-fields">
          <tbody>
            {Object.entries(f)
              .filter(([, value]) => value?.trim())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{key.replaceAll("_", " ")}</th>
                  <td>{value}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </li>
  );
}

type Props = {
  folderName: string;
  onExportExcel: () => void;
  ready: ReadyShot[];
  summary: ReturnType<typeof summarizeReports>;
};

/** The selected folder's accomplishment report: charts, per-screenshot reports and exports. */
export function ReportSection({
  folderName,
  onExportExcel,
  ready,
  summary,
}: Props) {
  const perDay = reportsPerDay(ready.map((shot) => shot.created_at));

  function exportPdf() {
    // Browsers use the page title as the suggested PDF file name.
    const title = document.title;
    document.title = `${folderName} – Accomplishment report`;
    // Print each full report too, then put the collapsed view back.
    const closed = [
      ...document.querySelectorAll<HTMLDetailsElement>(
        ".report-full:not([open])",
      ),
    ];
    closed.forEach((d) => (d.open = true));
    window.print();
    closed.forEach((d) => (d.open = false));
    document.title = title;
  }

  return (
    <article
      id="reports"
      aria-label="Accomplishment report"
      className="page-section report-section"
    >
      <SectionHeading
        title={`${folderName} · Accomplishment report`}
        description={
          summary.total
            ? `${summary.total} report${summary.total === 1 ? "" : "s"} · ${summary.recorded} with rectification time recorded`
            : undefined
        }
      >
        {summary.total > 0 && (
          <>
            <Button variant="outline" onClick={exportPdf}>
              <ArrowDownToLine size={15} />
              Export PDF
            </Button>
            <Button variant="outline" onClick={onExportExcel}>
              <ArrowDownToLine size={15} />
              Export Excel
            </Button>
          </>
        )}
      </SectionHeading>
      {summary.total > 0 ? (
        <>
          <p className="report-disclaimer">
            <ShieldCheck size={15} />
            Review extracted details before use. A recorded rectification time
            does not verify job completion.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Job categories">
              <Donut data={topWithOther(summary.categories)} />
            </ChartCard>
            <ChartCard title="Reports per day">
              <LineChart data={perDay} margin={{ left: -20, right: 12 }}>
                <CartesianGrid
                  stroke="var(--grid)"
                  vertical={false}
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="label"
                  tick={AXIS}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Reports"
                  stroke={SERIES[0]}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartCard>
            <ChartCard title="Issue types">
              <BarChart
                data={summary.issues}
                layout="vertical"
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid
                  stroke="var(--grid)"
                  horizontal={false}
                  strokeDasharray="3 4"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={AXIS}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={AXIS}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Reports"
                  fill={SERIES[0]}
                  radius={[0, 5, 5, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartCard>
            <ChartCard title="Rectification time recorded">
              <Donut data={summary.rectification} />
            </ChartCard>
          </div>
          <section className="mt-7">
            <h3 className="mb-4 text-base font-semibold">
              Reports ({ready.length})
            </h3>
            <ul className="report-list">
              {ready.map((shot) => (
                <ReportCard key={shot.id} shot={shot} />
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="report-placeholder no-print">
          No reports yet. Add items above and click Generate to see charts and
          exports.
        </p>
      )}
    </article>
  );
}
