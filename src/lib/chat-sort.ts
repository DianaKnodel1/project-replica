// Reihenfolge der Admin-Chat-Liste: eskaliert → offene Antwort (älteste zuerst)
// → zuletzt aktiv (neueste zuerst) → nie aktiv bzw. gesperrt ganz unten.
export type SortableChat = {
  status?: string | null;
  openCount?: number | null;
  openSince?: string | null;
  lastSeenAt?: string | null;
  lastAt?: string | null;
  blocked?: boolean;
};

export function compareChats(a: SortableChat, b: SortableChat): number {
  const esc = (c: SortableChat) => (c.status === "escalated" ? 1 : 0);
  if (esc(a) !== esc(b)) return esc(b) - esc(a);
  const open = (c: SortableChat) => ((c.openCount ?? 0) > 0 ? 1 : 0);
  if (open(a) !== open(b)) return open(b) - open(a);
  if (open(a) && open(b)) return (a.openSince ?? "").localeCompare(b.openSince ?? "");
  const rank = (c: SortableChat) => (c.blocked ? 2 : c.lastSeenAt ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const seen = (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
  if (seen !== 0) return seen;
  return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
}
