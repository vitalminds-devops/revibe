import type { Shot } from "@/lib/api";

// Measured on a 4-core CPU: image reading (~8 s) plus writing the report (~30 s); text skips the reading.
const DEFAULT_SECONDS = { image: 40, text: 30 };

/** Seconds to generate these items, from the measured average when there is one. */
export function estimateSeconds(shots: Shot[], measuredAverage?: number) {
  return shots.reduce(
    (total, shot) =>
      total +
      (measuredAverage ??
        (shot.source === "text"
          ? DEFAULT_SECONDS.text
          : DEFAULT_SECONDS.image)),
    0,
  );
}

/** "under a minute", "about 1 min", "about 4 min". */
export function approxTime(seconds: number) {
  return seconds < 45
    ? "under a minute"
    : `about ${Math.round(seconds / 60)} min`;
}
