import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { api } from "@/lib/api";
import type { CampaignDetail } from "@/lib/types";
import { FullScreenSpinner } from "@/components/Spinner";
import { relativeTime, statusBadgeClass } from "@/lib/format";

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<CampaignDetail>({
    queryKey: ["campaign", id],
    queryFn: async () => (await api.get(`/campaigns/${id}`)).data,
    refetchInterval: 5_000,
    enabled: !!id,
  });

  const start = useMutation({
    mutationFn: async () => (await api.post(`/campaigns/${id}/start`)).data,
    onSuccess: () => {
      toast.success("Started");
      qc.invalidateQueries({ queryKey: ["campaign", id] });
    },
  });
  const pause = useMutation({
    mutationFn: async () => (await api.post(`/campaigns/${id}/pause`)).data,
    onSuccess: () => {
      toast.success("Paused");
      qc.invalidateQueries({ queryKey: ["campaign", id] });
    },
  });

  if (isLoading || !data) return <FullScreenSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/campaigns" className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold flex-1">{data.name}</h1>
        <span className={statusBadgeClass(data.status)}>{data.status}</span>
        {data.status !== "running" && data.status !== "completed" && (
          <button className="btn-secondary" onClick={() => start.mutate()}>
            <Play className="h-4 w-4" /> Start
          </button>
        )}
        {data.status === "running" && (
          <button className="btn-secondary" onClick={() => pause.mutate()}>
            <Pause className="h-4 w-4" /> Pause
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Total" value={data.total} />
        <Stat label="Pending" value={data.pending} />
        <Stat label="Sent" value={data.sent} accent="emerald" />
        <Stat label="Failed" value={data.failed} accent="red" />
        <Stat label="Replied" value={data.replied} accent="brand" />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/40 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="p-3">Contact</th>
              <th className="p-3">Status</th>
              <th className="p-3">Sent</th>
              <th className="p-3">Rendered body</th>
              <th className="p-3">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.items.map((it) => (
              <tr key={it.id}>
                <td className="p-3 font-medium">@{it.contact_username || it.contact_id}</td>
                <td className="p-3">
                  <span className={statusBadgeClass(it.status)}>{it.status}</span>
                </td>
                <td className="p-3 text-xs text-slate-500">{relativeTime(it.sent_at)}</td>
                <td className="p-3 text-slate-400 max-w-md truncate">
                  {it.rendered_body || "—"}
                </td>
                <td className="p-3 text-red-400 text-xs">{it.error || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">No items.</div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "red" | "brand";
}) {
  const cls =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "red"
      ? "text-red-300"
      : accent === "brand"
      ? "text-brand-300"
      : "text-slate-100";
  return (
    <div className="card-pad">
      <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
