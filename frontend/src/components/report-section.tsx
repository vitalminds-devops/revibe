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
import { ArrowDownToLine, FileText, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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

type Props = {
  folderName: string;
  exportUrl: string;
  ready: ReadyShot[];
  summary: ReturnType<typeof summarizeReports>;
};

/** The selected folder's accomplishment report: charts, per-screenshot reports and exports. */
export function ReportSection({
  folderName,
  exportUrl,
  ready,
  summary,
}: Props) {
  const perDay = reportsPerDay(ready.map((shot) => shot.created_at));

  function exportPdf() {
    // Browsers use the page title as the suggested PDF file name.
    const title = document.title;
    document.title = `${folderName} – Accomplishment report`;
    window.print();
    document.title = title;
  }

  return (
    <article
      id="reports"
      aria-label="Accomplishment report"
      className="page-section report-section"
    >
      <SectionHeading
        step={4}
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
            <a
              className={buttonVariants({ variant: "outline" })}
              data-slot="button"
              href={exportUrl}
              download
            >
              <ArrowDownToLine size={15} />
              Export Excel
            </a>
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
              Reports by screenshot
            </h3>
            {ready.map((shot) => (
              <Card key={shot.id} className="mb-4 shadow-none">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <FileText size={16} className="text-primary" />
                      Screenshot #{shot.id}
                    </span>
                    <time
                      className="text-xs font-normal text-muted-foreground"
                      dateTime={shot.created_at}
                    >
                      {new Date(shot.created_at).toLocaleString()}
                    </time>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">
                    {shot.report}
                  </pre>
                  <details className="extracted-fields mt-5 rounded-lg border px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      View extracted fields
                    </summary>
                    <table className="mt-2 w-full table-fixed border-collapse text-sm">
                      <tbody>
                        {Object.entries(shot.fields).map(([key, value]) => (
                          <tr
                            key={key}
                            className="border-b align-top last:border-0"
                          >
                            <th
                              scope="row"
                              className="w-1/3 break-words py-2 pr-4 text-left font-medium capitalize"
                            >
                              {key.replaceAll("_", " ")}
                            </th>
                            <td className="break-words py-2 text-muted-foreground">
                              {value || "Not recorded"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      ) : (
        <p className="report-placeholder no-print">
          No reports yet. Generate reports in step 2 to see charts and exports.
        </p>
      )}
    </article>
  );
}
