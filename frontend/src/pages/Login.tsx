import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/Spinner";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("changeme123");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { email, password });
      setAuth(r.data.access_token, r.data.user);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/40">
      <div className="w-full max-w-md card-pad">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold">DM</div>
            <div className="text-xs text-slate-400">Instagram auto-DM suite</div>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-sm text-slate-400 mb-6">Sign in to your dashboard.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner /> : "Sign in"}
          </button>
        </form>

        <p className="text-sm text-slate-400 text-center mt-6">
          New here?{" "}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
            Create an account
          </Link>
        </p>

        <div className="mt-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400">
          <strong className="text-slate-300">Default admin:</strong> admin@example.com / changeme123
          (change in <code className="text-brand-400">backend/.env</code>).
        </div>
      </div>
    </div>
  );
}
