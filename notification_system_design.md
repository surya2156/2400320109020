## Stage 1

```ts
/**
 * Stage 1 — Priority Inbox algorithm
 *
 * Sorting weights:
 *  - Placements: weight 3
 *  - Results:    weight 2
 *  - Events:     weight 1
 *
 * Primary sort: weight (descending)
 * Secondary sort: created_at (most recent first)
 *
 * Returns the top `limit` items from an in-memory array (no DB).
 */

type Notification = {
  id: string;
  notification_type?: string; // e.g. "Placements", "Results", "Events" (case-insensitive)
  created_at?: string; // ISO timestamp
  [key: string]: any;
};

const TYPE_WEIGHT_MAP: Record<string, number> = {
  placements: 3,
  placement: 3,
  results: 2,
  result: 2,
  events: 1,
  event: 1,
};

function normalizeType(t?: string): string {
  return (t || '').trim().toLowerCase();
}

/**
 * Compute the priority inbox from an array of notifications.
 * - Accepts raw notifications array (pulled from GET http://4.224.186.213/evaluation-service/notifications)
 * - Sorts by weight then by timestamp (newest first)
 * - Returns top `limit` items
 */
export function computePriorityInbox(
  notifications: Notification[],
  limit: number
): Notification[] {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];

  const weightFor = (n: Notification): number => {
    const t = normalizeType(n.notification_type ?? n.type);
    return TYPE_WEIGHT_MAP[t] ?? 0;
  };

  const parseTime = (iso?: string): number => {
    const v = Date.parse(iso ?? '');
    return Number.isFinite(v) ? v : 0;
  };

  // Sort a copy and slice top limit
  const sorted = notifications
    .slice()
    .sort((a, b) => {
      const wa = weightFor(a);
      const wb = weightFor(b);
      if (wb !== wa) return wb - wa; // higher weight first

      const ta = parseTime(a.created_at);
      const tb = parseTime(b.created_at);
      return tb - ta; // newest first
    });

  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  return safeLimit > 0 ? sorted.slice(0, safeLimit) : [];
}

```
