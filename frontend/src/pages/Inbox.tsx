import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Inbox as InboxIcon, RefreshCw, Send } from "lucide-react";
import { api } from "@/lib/api";
import type { Account, Thread, ThreadDetail } from "@/lib/types";
import { FullScreenSpinner, Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { relativeTime } from "@/lib/format";

export function InboxPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [threadId, setThreadId] = useState<number | null>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const { data: threads = [], isLoading } = useQuery<Thread[]>({
    queryKey: ["threads", accountId],
    queryFn: async () =>
      (
        await api.get("/inbox/threads", {
          params: { account_id: accountId ?? undefined },
        })
      ).data,
    refetchInterval: 10_000,
  });

  const sync = useMutation({
    mutationFn: async () => {
      if (!accountId) {
        const a = accounts.find((x) => x.is_connected);
        if (!a) throw new Error("No connected account");
        return (await api.post("/inbox/sync", null, { params: { account_id: a.id } })).data;
      }
      return (await api.post("/inbox/sync", null, { params: { account_id: accountId } })).data;
    },
    onSuccess: (d: { new_threads: number; new_messages: number }) => {
      toast.success(`Synced: ${d.new_threads} threads, ${d.new_messages} msgs`);
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Sync failed"),
  });

  if (isLoading) return <FullScreenSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-slate-400">View replies and continue conversations.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="input w-auto"
            value={accountId ?? ""}
            onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.username}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </div>

      {threads.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="h-6 w-6" />}
          title="No conversations yet"
          description="Replies and incoming DMs will show up here. Click Sync to pull recent threads."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[60vh]">
          <ul className="card divide-y divide-slate-800 max-h-[75vh] overflow-y-auto">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  className={`w-full text-left p-3 hover:bg-slate-900/50 ${
                    threadId === t.id ? "bg-slate-900/70" : ""
                  }`}
                  onClick={() => setThreadId(t.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">
                      @{t.contact_username || t.title || "unknown"}
                    </span>
                    {t.unread_count > 0 && (
                      <span className="badge-info">{t.unread_count}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {t.last_snippet || "—"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {relativeTime(t.last_message_at)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="lg:col-span-2 card-pad min-h-[60vh] flex flex-col">
            {threadId ? (
              <ThreadView threadId={threadId} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadView({ threadId }: { threadId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<ThreadDetail>({
    queryKey: ["thread", threadId],
    queryFn: async () => (await api.get(`/inbox/threads/${threadId}`)).data,
    refetchInterval: 10_000,
  });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await api.post(`/inbox/threads/${threadId}/reply`, { body });
      setBody("");
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
      qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed");
    } finally {
      setSending(false);
    }
  }

  if (isLoading || !data) return <FullScreenSpinner />;

  return (
    <>
      <div className="border-b border-slate-800 pb-3 mb-3">
        <div className="font-semibold">@{data.contact_username || data.title}</div>
        <div className="text-xs text-slate-500">
          {data.messages.length} messages · last {relativeTime(data.last_message_at)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {data.messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.direction === "outbound"
                ? "ml-auto bg-gradient-to-r from-brand-500 to-purple-600 text-white"
                : "bg-slate-800 text-slate-100"
            }`}
          >
            <div>{m.body}</div>
            <div
              className={`text-[10px] mt-1 ${
                m.direction === "outbound" ? "text-white/70" : "text-slate-400"
              }`}
            >
              {m.status} · {relativeTime(m.created_at)}
            </div>
            {m.error && (
              <div className="text-[10px] text-red-200 mt-0.5">{m.error}</div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a reply…"
        />
        <button className="btn-primary" disabled={sending || !body.trim()}>
          {sending ? <Spinner /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </>
  );
}
