const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "just now". Computed on the server so it never rehydrates differently. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "never";

  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (Number.isNaN(seconds)) return "unknown";

  const magnitude = Math.abs(seconds);
  if (magnitude < 45) return "just now";

  for (const [unit, unitSeconds] of UNITS) {
    if (magnitude >= unitSeconds) {
      return relative.format(Math.round(seconds / unitSeconds), unit);
    }
  }

  return relative.format(Math.round(seconds / 60), "minute");
}

/** "2:30" for a duration expressed in frames. */
export function formatDuration(frames: number, fps: number): string {
  const totalSeconds = Math.round(frames / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
