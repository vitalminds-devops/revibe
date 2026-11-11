"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  Monitor,
  Plus,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeading } from "@/components/section-heading";
import { isPending, type Shot } from "@/lib/api";

type Filter = "all" | "pending" | "ready";

const EMPTY: Record<Filter, string> = {
  all: "No screenshots in this folder yet.",
  pending: "No screenshots waiting for a report.",
  ready: "No reports yet.",
};

type Props = {
  shots: Shot[];
  loading: boolean;
  canAdd: boolean;
  onAdd: () => void;
};

/** Screenshots in the selected folder, filterable by report status. */
export function ScreenshotGrid({ shots, loading, canAdd, onAdd }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = shots.filter(
    (shot) =>
      filter === "all" ||
      (filter === "ready" ? !!shot.report : isPending(shot)),
  );

  return (
    <section
      id="screenshots"
      className="page-section no-print"
      aria-label="Screenshots"
    >
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as Filter)}
      >
        <SectionHeading step={3} title={`Review screenshots (${shots.length})`}>
          <TabsList aria-label="Filter screenshots">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
          </TabsList>
        </SectionHeading>
        <TabsContent value={filter}>
          {loading ? (
            <div className="screenshot-grid" aria-label="Loading screenshots">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="skeleton h-56 rounded-xl" />
              ))}
            </div>
          ) : visible.length ? (
            <ul className="screenshot-grid">
              {visible.map((shot) => (
                <li key={shot.id} className="shot-card">
                  <a
                    href={shot.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shot-image-link"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URLs are not optimizable */}
                    <img
                      src={shot.image_url}
                      alt={`Open screenshot ${shot.id}`}
                      className="shot-image"
                    />
                    <span className="shot-open">
                      Open screenshot <ArrowRight size={14} />
                    </span>
                  </a>
                  <div className="shot-info">
                    <div className="flex items-center justify-between gap-2">
                      <h3>Screenshot #{shot.id}</h3>
                      {shot.source === "screen" ? (
                        <Monitor size={14} />
                      ) : (
                        <Upload size={14} />
                      )}
                    </div>
                    <time dateTime={shot.created_at}>
                      {new Date(shot.created_at).toLocaleString()}
                    </time>
                    <Badge
                      variant="secondary"
                      className={`shot-status ${shot.report ? "ready" : shot.error ? "failed" : "pending"}`}
                    >
                      {shot.report ? (
                        <Check size={12} />
                      ) : shot.error ? (
                        <CircleAlert size={12} />
                      ) : (
                        <Clock3 size={12} />
                      )}
                      {shot.report
                        ? "Report ready"
                        : shot.error
                          ? "Failed"
                          : "Waiting for report"}
                    </Badge>
                    {shot.error && (
                      <p className="mt-2 break-words text-xs text-destructive">
                        {shot.error}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <p>{EMPTY[filter]}</p>
              {filter === "all" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAdd}
                  disabled={!canAdd}
                >
                  <Plus size={14} />
                  Add screenshots
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
