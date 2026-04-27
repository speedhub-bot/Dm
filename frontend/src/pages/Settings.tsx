import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export function SettingsPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<{ ok: boolean; demo_mode: boolean; name: string } | null>(
    null,
  );

  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-400">Account and system info.</p>
      </div>

      <div className="card-pad space-y-3">
        <h2 className="text-base font-semibold">Profile</h2>
        <Row label="Email" value={user?.email ?? "—"} />
        <Row label="Full name" value={user?.full_name ?? "—"} />
        <Row label="Role" value={user?.is_admin ? "Admin" : "Member"} />
      </div>

      <div className="card-pad space-y-3">
        <h2 className="text-base font-semibold">System</h2>
        <Row label="App" value={health?.name ?? "—"} />
        <Row
          label="Demo mode"
          value={
            health?.demo_mode === undefined ? "—" : health.demo_mode ? "Enabled" : "Disabled"
          }
        />
        <Row label="API" value={health?.ok ? "Healthy" : "Unreachable"} />
      </div>

      <div className="card-pad space-y-3">
        <h2 className="text-base font-semibold">Tips for staying out of jail</h2>
        <ul className="list-disc pl-6 text-sm text-slate-400 space-y-1.5">
          <li>Warm up new IG accounts: 5–10 DMs/day for the first week.</li>
          <li>Keep daily caps under 50/day and hourly caps under 12/hour.</li>
          <li>Use realistic delays (45–120s) and stay within working hours.</li>
          <li>Use spintax variants — never send the same exact text twice.</li>
          <li>Respect users who reply "stop" — add them to a do-not-contact list.</li>
        </ul>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  );
}
