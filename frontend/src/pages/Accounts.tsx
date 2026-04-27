import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Instagram, Plus, Trash2, Power, PowerOff, Settings as SettingsIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { Account } from "@/lib/types";
import { FullScreenSpinner, Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { relativeTime } from "@/lib/format";

export function AccountsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const [open, setOpen] = useState(false);
  const [tweak, setTweak] = useState<Account | null>(null);

  if (isLoading) return <FullScreenSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instagram accounts</h1>
          <p className="text-sm text-slate-400">Connect and manage your IG accounts.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Connect account
        </button>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          icon={<Instagram className="h-6 w-6" />}
          title="No accounts connected"
          description="Connect your first Instagram account to start sending DMs."
          action={
            <button className="btn-primary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Connect account
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((a) => (
            <AccountCard key={a.id} account={a} onTweak={() => setTweak(a)} qc={qc} />
          ))}
        </div>
      )}

      <ConnectAccountModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["accounts"] })}
      />
      <SettingsModal account={tweak} onClose={() => setTweak(null)} qc={qc} />
    </div>
  );
}

function AccountCard({
  account,
  onTweak,
  qc,
}: {
  account: Account;
  onTweak: () => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const disconnect = useMutation({
    mutationFn: async () => (await api.post(`/accounts/${account.id}/disconnect`)).data,
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const del = useMutation({
    mutationFn: async () => (await api.delete(`/accounts/${account.id}`)).data,
    onSuccess: () => {
      toast.success("Account removed");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return (
    <div className="card-pad">
      <div className="flex items-start gap-3">
        <img
          src={
            account.profile_pic_url ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.username}`
          }
          alt={account.username}
          className="h-12 w-12 rounded-full bg-slate-800 ring-2 ring-slate-800"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">@{account.username}</span>
            {account.is_connected ? (
              <span className="badge-success">Connected</span>
            ) : (
              <span className="badge-muted">Disconnected</span>
            )}
          </div>
          <div className="text-xs text-slate-400 truncate">{account.display_name}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            Last login: {relativeTime(account.last_login_at)}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>Daily cap: <span className="text-slate-200">{account.daily_cap}</span></div>
        <div>Hourly cap: <span className="text-slate-200">{account.hourly_cap}</span></div>
        <div>
          Delay: <span className="text-slate-200">{account.min_delay_sec}–{account.max_delay_sec}s</span>
        </div>
        <div>
          Hours:{" "}
          <span className="text-slate-200">
            {account.work_hours_start}–{account.work_hours_end}
          </span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-secondary flex-1" onClick={onTweak}>
          <SettingsIcon className="h-4 w-4" /> Settings
        </button>
        {account.is_connected ? (
          <button
            className="btn-ghost"
            onClick={() => disconnect.mutate()}
            title="Disconnect"
          >
            <PowerOff className="h-4 w-4" />
          </button>
        ) : (
          <span className="btn-ghost opacity-40">
            <Power className="h-4 w-4" />
          </span>
        )}
        <button
          className="btn-ghost text-red-400"
          onClick={() => {
            if (confirm(`Remove @${account.username}?`)) del.mutate();
          }}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ConnectAccountModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/accounts/connect", {
        username: username.trim(),
        password,
        verification_code: code || null,
      });
      toast.success(`Connected @${username}`);
      onSuccess();
      onClose();
      setUsername("");
      setPassword("");
      setCode("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Instagram account">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 px-3 py-2 text-xs text-amber-300">
          Demo mode is on by default — no real Instagram login is performed. Toggle{" "}
          <code>DEMO_MODE=false</code> in <code>backend/.env</code> for live connections.
        </div>
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">2FA code (optional)</label>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : "Connect"}
        </button>
      </form>
    </Modal>
  );
}

function SettingsModal({
  account,
  onClose,
  qc,
}: {
  account: Account | null;
  onClose: () => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [draft, setDraft] = useState<Partial<Account>>(account ?? {});
  const [loading, setLoading] = useState(false);

  // re-init when account changes
  if (account && draft.id !== account.id) {
    setDraft(account);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!account) return;
    setLoading(true);
    try {
      await api.patch(`/accounts/${account.id}`, {
        min_delay_sec: draft.min_delay_sec,
        max_delay_sec: draft.max_delay_sec,
        daily_cap: draft.daily_cap,
        hourly_cap: draft.hourly_cap,
        work_hours_start: draft.work_hours_start,
        work_hours_end: draft.work_hours_end,
        notes: draft.notes ?? null,
      });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (!account) return null;
  return (
    <Modal open={!!account} onClose={onClose} title={`Settings for @${account.username}`} size="lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Min delay (s)"
            value={draft.min_delay_sec ?? account.min_delay_sec}
            onChange={(v) => setDraft({ ...draft, min_delay_sec: v })}
          />
          <NumField
            label="Max delay (s)"
            value={draft.max_delay_sec ?? account.max_delay_sec}
            onChange={(v) => setDraft({ ...draft, max_delay_sec: v })}
          />
          <NumField
            label="Hourly cap"
            value={draft.hourly_cap ?? account.hourly_cap}
            onChange={(v) => setDraft({ ...draft, hourly_cap: v })}
          />
          <NumField
            label="Daily cap"
            value={draft.daily_cap ?? account.daily_cap}
            onChange={(v) => setDraft({ ...draft, daily_cap: v })}
          />
          <NumField
            label="Work hours start (0-23)"
            value={draft.work_hours_start ?? account.work_hours_start}
            onChange={(v) => setDraft({ ...draft, work_hours_start: v })}
            min={0}
            max={23}
          />
          <NumField
            label="Work hours end (0-23)"
            value={draft.work_hours_end ?? account.work_hours_end}
            onChange={(v) => setDraft({ ...draft, work_hours_end: v })}
            min={0}
            max={23}
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[80px]"
            value={draft.notes ?? ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : "Save"}
        </button>
      </form>
    </Modal>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
