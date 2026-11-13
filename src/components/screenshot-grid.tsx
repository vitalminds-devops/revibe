"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  ClipboardPaste,
  Clock3,
  Monitor,
  Layers,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isPending, type Shot } from "@/lib/api";

type Filter = "all" | "pending" | "ready";

const EMPTY: Record<Filter, string> = {
  all: "Nothing in this folder yet.",
  pending: "Nothing waiting for a report.",
  ready: "No reports yet.",
};

type Props = {
  shots: Shot[];
  loading: boolean;
  canAdd: boolean;
  onAdd: () => void;
  /** Undefined while the page is busy: the delete buttons stay visible but disabled. */
  onDelete?: (shot: Shot) => void;
  /** Merges screenshots of one long message; resolves true when done. Undefined while busy. */
  onCombine?: (shots: Shot[]) => Promise<boolean>;
};

/** Screenshots and pasted texts in the selected folder, filterable by report status. */
export function ScreenshotGrid({
  shots,
  loading,
  canAdd,
  onAdd,
  onDelete,
  onCombine,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number[]>([]);
  const picked = shots.filter((shot) => selected.includes(shot.id));
  const toggle = (id: number) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  const visible = shots.filter(
    (shot) =>
      filter === "all" ||
      (filter === "ready" ? !!shot.report : isPending(shot)),
  );

  return (
    <section
      id="screenshots"
      className="no-print"
      aria-label="Items in this folder"
    >
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as Filter)}
      >
        <div className="grid-filter">
          <TabsList aria-label="Filter">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Waiting</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
          </TabsList>
        </div>
        {picked.length > 0 && (
          <div className="combine-bar" role="region" aria-label="Combine">
            <p>
              <strong>{picked.length} selected.</strong> Screenshots of one long
              message become one report, in the order they were added.
            </p>
            <Button
              size="sm"
              disabled={picked.length < 2 || !onCombine}
              onClick={async () => {
                if (await onCombine?.(picked)) setSelected([]);
              }}
            >
              <Layers size={14} />
              Combine into one report
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        )}
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
                <li
                  key={shot.id}
                  className={`shot-card ${selected.includes(shot.id) ? "is-selected" : ""}`}
                >
                  {shot.image_url && (
                    <label className="shot-select" title="Select to combine">
                      <input
                        type="checkbox"
                        checked={selected.includes(shot.id)}
                        onChange={() => toggle(shot.id)}
                      />
                      <span className="sr-only">
                        Select screenshot #{shot.id} to combine
                      </span>
                    </label>
                  )}
                  {shot.extra_image_urls.length > 0 && (
                    <span className="shot-parts">
                      <Layers size={12} />
                      {shot.extra_image_urls.length + 1} parts
                    </span>
                  )}
                  {shot.image_url ? (
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
                  ) : (
                    <p className="shot-text">{shot.text}</p>
                  )}
                  <div className="shot-info">
                    <div className="flex items-center justify-between gap-2">
                      <h3>
                        {shot.source === "text" ? "Text" : "Screenshot"} #
                        {shot.id}
                      </h3>
                      <span className="flex items-center gap-1">
                        {shot.source === "text" ? (
                          <ClipboardPaste size={14} />
                        ) : shot.source === "screen" ? (
                          <Monitor size={14} />
                        ) : (
                          <Upload size={14} />
                        )}
                        <button
                          type="button"
                          className="shot-delete"
                          aria-label={`Delete ${shot.source === "text" ? "text" : "screenshot"} #${shot.id}`}
                          title="Delete"
                          disabled={!onDelete}
                          onClick={() => onDelete?.(shot)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                    <time dateTime={shot.created_at}>
                      {new Date(shot.created_at).toLocaleString()}
                    </time>
                    {shot.extra_image_urls.length > 0 && (
                      <p className="shot-part-links">
                        Open part{" "}
                        {shot.extra_image_urls.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {i + 2}
                          </a>
                        ))}
                      </p>
                    )}
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
