import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Pause, Play, Plus, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Account, Campaign, ContactList, Template } from "@/lib/types";
import { FullScreenSpinner, Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { relativeTime, statusBadgeClass } from "@/lib/format";

export function CampaignsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => (await api.get("/campaigns")).data,
    refetchInterval: 8_000,
  });
  const [creating, setCreating] = useState(false);

  if (isLoading) return <FullScreenSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-slate-400">Schedule and run DM campaigns at scale.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          icon={<Send className="h-6 w-6" />}
          title="No campaigns yet"
          description="Create your first campaign — pick an account, a template, and a list."
          action={
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New campaign
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/40 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Status</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Replied</th>
                <th className="p-3">Updated</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40">
                  <td className="p-3">
                    <Link to={`/campaigns/${c.id}`} className="font-medium hover:text-brand-300">
                      {c.name}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className={statusBadgeClass(c.status)}>{c.status}</span>
                  </td>
                  <td className="p-3 min-w-[180px]">
                    <Progress sent={c.sent} failed={c.failed} total={c.total} />
                  </td>
                  <td className="p-3">{c.replied}</td>
                  <td className="p-3 text-slate-500 text-xs">{relativeTime(c.updated_at)}</td>
                  <td className="p-3 text-right space-x-1">
                    <CampaignActions campaign={c} qc={qc} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewCampaignModal
        open={creating}
        onClose={() => setCreating(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["campaigns"] })}
      />
    </div>
  );
}

function Progress({
  sent,
  failed,
  total,
}: {
  sent: number;
  failed: number;
  total: number;
}) {
  const sentPct = total ? (sent / total) * 100 : 0;
  const failPct = total ? (failed / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex">
        <div className="h-full bg-emerald-500" style={{ width: `${sentPct}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${failPct}%` }} />
      </div>
      <div className="text-[11px] text-slate-500">
        {sent}/{total} sent · {failed} failed
      </div>
    </div>
  );
}

function CampaignActions({
  campaign,
  qc,
}: {
  campaign: Campaign;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const start = useMutation({
    mutationFn: async () => (await api.post(`/campaigns/${campaign.id}/start`)).data,
    onSuccess: () => {
      toast.success("Started");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
  const pause = useMutation({
    mutationFn: async () => (await api.post(`/campaigns/${campaign.id}/pause`)).data,
    onSuccess: () => {
      toast.success("Paused");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
  const del = useMutation({
    mutationFn: async () => (await api.delete(`/campaigns/${campaign.id}`)).data,
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
  return (
    <>
      {campaign.status !== "running" && campaign.status !== "completed" && (
        <button className="btn-ghost text-emerald-400" onClick={() => start.mutate()} title="Start">
          <Play className="h-4 w-4" />
        </button>
      )}
      {campaign.status === "running" && (
        <button className="btn-ghost text-amber-400" onClick={() => pause.mutate()} title="Pause">
          <Pause className="h-4 w-4" />
        </button>
      )}
      <button
        className="btn-ghost text-red-400"
        onClick={() => {
          if (confirm(`Delete campaign "${campaign.name}"?`)) del.mutate();
        }}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );
}

function NewCampaignModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [listId, setListId] = useState<number | null>(null);
  const [startNow, setStartNow] = useState(true);
  const [loading, setLoading] = useState(false);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
    enabled: open,
  });
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data,
    enabled: open,
  });
  const { data: lists = [] } = useQuery<ContactList[]>({
    queryKey: ["contact-lists"],
    queryFn: async () => (await api.get("/contact-lists")).data,
    enabled: open,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!accountId || !templateId) {
      toast.error("Account and template required");
      return;
    }
    if (!listId) {
      toast.error("Pick a contact list");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/campaigns", {
        name,
        account_id: accountId,
        template_id: templateId,
        list_id: listId,
      });
      if (startNow) {
        await api.post(`/campaigns/${r.data.id}/start`);
      }
      toast.success("Campaign created");
      onSuccess();
      onClose();
      setName("");
      setAccountId(null);
      setTemplateId(null);
      setListId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New campaign" size="lg">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Account</label>
            <select
              className="input"
              value={accountId ?? ""}
              onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option value="">Select…</option>
              {accounts
                .filter((a) => a.is_connected)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Template</label>
            <select
              className="input"
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Contact list</label>
          <select
            className="input"
            value={listId ?? ""}
            onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)}
            required
          >
            <option value="">Select…</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.member_count})
              </option>
            ))}
          </select>
          {lists.length === 0 && (
            <p className="text-xs text-amber-400 mt-1">
              No lists yet — go to Contacts and create one.
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={startNow}
            onChange={(e) => setStartNow(e.target.checked)}
          />
          Start immediately after creation
        </label>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : "Create campaign"}
        </button>
      </form>
    </Modal>
  );
}
