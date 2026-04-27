import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/layouts/AppShell";
import { LoginPage } from "@/pages/Login";
import { RegisterPage } from "@/pages/Register";
import { DashboardPage } from "@/pages/Dashboard";
import { AccountsPage } from "@/pages/Accounts";
import { ContactsPage } from "@/pages/Contacts";
import { TemplatesPage } from "@/pages/Templates";
import { CampaignsPage } from "@/pages/Campaigns";
import { CampaignDetailPage } from "@/pages/CampaignDetail";
import { InboxPage } from "@/pages/Inbox";
import { AnalyticsPage } from "@/pages/Analytics";
import { SettingsPage } from "@/pages/Settings";
import { FullScreenSpinner } from "@/components/Spinner";

function ProtectedRoutes() {
  const { token, user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    if (user) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        navigate("/login");
      });
  }, [token, user, setUser, navigate]);

  if (loading) return <FullScreenSpinner />;
  if (!token) return null;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}
