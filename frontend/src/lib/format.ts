export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

export function formatPercent(p: number | undefined | null): string {
  if (p === undefined || p === null) return "0%";
  return (p * 100).toFixed(1) + "%";
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "running":
    case "sent":
    case "completed":
    case "delivered":
      return "badge-success";
    case "scheduled":
    case "pending":
    case "queued":
      return "badge-info";
    case "paused":
    case "draft":
      return "badge-muted";
    case "failed":
      return "badge-danger";
    default:
      return "badge-muted";
  }
}
