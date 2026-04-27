import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  MessageSquare,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { formatNumber, formatPercent, relativeTime } from "@/lib/format";
import { FullScreenSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";

export function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/analytics/dashboard")).data,
    refetchInterval: 15_000,
  });

  if (isLoading || !data) return <FullScreenSpinner />;
  const { kpi, timeseries, top_accounts, recent_events } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-400">Overview of your outreach performance.</p>
        </div>
        <Link to="/campaigns" className="btn-primary">
          <Send className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Send className="h-4 w-4" />}
          label="Sent today"
          value={formatNumber(kpi.sent_today)}
          accent="brand"
        />
        <KpiCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Total sent"
          value={formatNumber(kpi.sent_total)}
          accent="purple"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Reply rate"
          value={formatPercent(kpi.reply_rate)}
          accent="emerald"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Active campaigns"
          value={formatNumber(kpi.campaigns_active)}
          accent="sky"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiSmall icon={<Sparkles className="h-3 w-3" />} label="Accounts" value={kpi.accounts} />
        <KpiSmall icon={<Users className="h-3 w-3" />} label="Contacts" value={kpi.contacts} />
        <KpiSmall
          icon={<CheckCircle2 className="h-3 w-3" />}
          label="Replies"
          value={kpi.replied_total}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-pad">
          <h2 className="text-base font-semibold mb-1">Last 14 days</h2>
          <p className="text-xs text-slate-400 mb-4">Sent vs replied vs failed.</p>
          {timeseries.length === 0 ? (
            <EmptyState title="No activity yet" description="Send your first campaign to see data here." />
          ) : (
            <div className="h-72 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries}>
                  <defs>
                    <linearGradient id="sent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="rep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke="#ec4899"
                    fill="url(#sent)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="replied"
                    name="Replied"
                    stroke="#10b981"
                    fill="url(#rep)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke="#ef4444"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-pad">
          <h2 className="text-base font-semibold mb-3">Top accounts</h2>
          {top_accounts.length === 0 ? (
            <p className="text-sm text-slate-400">No data yet.</p>
          ) : (
            <ul className="space-y-3">
              {top_accounts.map((a) => (
                <li key={a.account_id} className="flex items-center justify-between">
                  <span className="text-sm">@{a.username}</span>
                  <span className="badge-info">{formatNumber(a.sent)} sent</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card-pad">
        <h2 className="text-base font-semibold mb-3">Recent activity</h2>
        {recent_events.length === 0 ? (
          <p className="text-sm text-slate-400">No events yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {recent_events.map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{e.message}</div>
                  <div className="text-xs text-slate-500">{e.type}</div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {relativeTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "brand" | "purple" | "emerald" | "sky";
}) {
  const grad = {
    brand: "from-brand-500/20 to-brand-500/0 ring-brand-500/30 text-brand-300",
    purple: "from-purple-500/20 to-purple-500/0 ring-purple-500/30 text-purple-300",
    emerald: "from-emerald-500/20 to-emerald-500/0 ring-emerald-500/30 text-emerald-300",
    sky: "from-sky-500/20 to-sky-500/0 ring-sky-500/30 text-sky-300",
  }[accent];
  return (
    <div className={`card-pad bg-gradient-to-br ${grad} ring-1`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

function KpiSmall({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="card px-4 py-3 flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </span>
      <span className="text-lg font-semibold">{formatNumber(value)}</span>
    </div>
  );
}
