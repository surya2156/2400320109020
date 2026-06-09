type Notification = {
  id: string;
  notification_type?: string;
  created_at?: string;
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

  const sorted = notifications
    .slice()
    .sort((a, b) => {
      const wa = weightFor(a);
      const wb = weightFor(b);
      if (wb !== wa) return wb - wa;
      const ta = parseTime(a.created_at);
      const tb = parseTime(b.created_at);
      return tb - ta;
    });

  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  return safeLimit > 0 ? sorted.slice(0, safeLimit) : [];
}
