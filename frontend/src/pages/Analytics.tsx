import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { FullScreenSpinner } from "@/components/Spinner";
import { formatNumber, formatPercent } from "@/lib/format";

export function AnalyticsPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/analytics/dashboard")).data,
  });

  if (isLoading || !data) return <FullScreenSpinner />;
  const { kpi, timeseries, top_accounts } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-slate-400">Detailed performance breakdown.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total sent" value={formatNumber(kpi.sent_total)} />
        <Stat label="Total replied" value={formatNumber(kpi.replied_total)} />
        <Stat label="Reply rate" value={formatPercent(kpi.reply_rate)} />
        <Stat label="Failed" value={formatNumber(kpi.failed_total)} />
      </div>

      <div className="card-pad">
        <h2 className="text-base font-semibold mb-3">Daily volume</h2>
        <div className="h-80 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeseries}>
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
              <Bar dataKey="sent" name="Sent" fill="#ec4899" radius={[4, 4, 0, 0]} />
              <Bar dataKey="replied" name="Replied" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-pad">
        <h2 className="text-base font-semibold mb-3">Top accounts by sent volume</h2>
        {top_accounts.length === 0 ? (
          <p className="text-sm text-slate-400">No data yet.</p>
        ) : (
          <ul className="space-y-2">
            {top_accounts.map((a) => (
              <li key={a.account_id} className="flex items-center justify-between">
                <span className="text-sm">@{a.username}</span>
                <div className="flex items-center gap-3 flex-1 max-w-md ml-4">
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-purple-600"
                      style={{
                        width: `${
                          (a.sent / Math.max(...top_accounts.map((t) => t.sent))) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-300 w-12 text-right">
                    {formatNumber(a.sent)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-pad">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
