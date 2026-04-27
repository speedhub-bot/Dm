import { ChangeEvent, FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ListPlus,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Account, Contact, ContactList } from "@/lib/types";
import { FullScreenSpinner, Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { relativeTime } from "@/lib/format";

export function ContactsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [activeList, setActiveList] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showScrape, setShowScrape] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["contacts", q, activeList],
    queryFn: async () =>
      (
        await api.get("/contacts", {
          params: { q: q || undefined, list_id: activeList ?? undefined },
        })
      ).data,
  });
  const { data: lists = [] } = useQuery<ContactList[]>({
    queryKey: ["contact-lists"],
    queryFn: async () => (await api.get("/contact-lists")).data,
  });

  if (isLoading) return <FullScreenSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-slate-400">Build your outreach lists.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowScrape(true)}>
            <UserPlus className="h-4 w-4" />
            Scrape from IG
          </button>
          <button className="btn-secondary" onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4" />
            Bulk import
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add contact
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lists</h2>
            <button
              className="btn-ghost text-xs"
              onClick={() => setShowCreateList(true)}
              title="Create list"
            >
              <ListPlus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setActiveList(null)}
            className={`w-full text-left text-sm rounded-md px-2 py-1.5 ${
              activeList === null
                ? "bg-brand-500/10 text-brand-300"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            All contacts
          </button>
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveList(l.id)}
              className={`w-full text-left text-sm rounded-md px-2 py-1.5 flex items-center justify-between ${
                activeList === l.id
                  ? "bg-brand-500/10 text-brand-300"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="truncate">{l.name}</span>
              <span className="text-xs text-slate-500">{l.member_count}</span>
            </button>
          ))}
          {lists.length === 0 && (
            <p className="text-xs text-slate-500">No lists yet. Create one to organize contacts.</p>
          )}
        </aside>

        <section className="lg:col-span-3 space-y-3">
          <div className="card flex items-center px-3 gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="bg-transparent flex-1 py-2.5 text-sm focus:outline-none"
              placeholder="Search by username or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {contacts.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No contacts found"
              description="Import contacts from CSV, scrape an IG user's followers, or add them manually."
            />
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/40 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="p-3">Username</th>
                    <th className="p-3">Full name</th>
                    <th className="p-3">Tags</th>
                    <th className="p-3">Added</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {contacts.map((c) => (
                    <ContactRow key={c.id} contact={c} qc={qc} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <AddContactModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
      />
      <BulkImportModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
      />
      <ScrapeModal
        open={showScrape}
        onClose={() => setShowScrape(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["contacts"] });
          qc.invalidateQueries({ queryKey: ["contact-lists"] });
        }}
        lists={lists}
      />
      <CreateListModal
        open={showCreateList}
        onClose={() => setShowCreateList(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["contact-lists"] })}
      />
    </div>
  );
}

function ContactRow({
  contact,
  qc,
}: {
  contact: Contact;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const del = useMutation({
    mutationFn: async () => (await api.delete(`/contacts/${contact.id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
  return (
    <tr className="hover:bg-slate-900/40">
      <td className="p-3 font-medium">@{contact.username}</td>
      <td className="p-3 text-slate-400">{contact.full_name || "—"}</td>
      <td className="p-3">
        {contact.tags ? (
          <span className="badge-info">{contact.tags}</span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="p-3 text-slate-500 text-xs">{relativeTime(contact.created_at)}</td>
      <td className="p-3 text-right">
        <button
          className="btn-ghost text-red-400"
          onClick={() => {
            if (confirm(`Delete @${contact.username}?`)) del.mutate();
          }}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function AddContactModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/contacts", {
        username: username.trim(),
        full_name: fullName || null,
        tags: tags || null,
      });
      toast.success("Contact added");
      setUsername("");
      setFullName("");
      setTags("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add contact">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">Tags (comma separated)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : "Add"}
        </button>
      </form>
    </Modal>
  );
}

function BulkImportModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function paste(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const usernames = text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await api.post("/contacts/bulk", { usernames });
      toast.success(`Added ${r.data.length} contacts`);
      setText("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function csv(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    setLoading(true);
    try {
      const r = await api.post("/contacts/import-csv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`Imported ${r.data.length} contacts`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "CSV import failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk import contacts" size="lg">
      <form onSubmit={paste} className="space-y-4">
        <div>
          <label className="label">Paste usernames (one per line or comma separated)</label>
          <textarea
            className="input min-h-[140px] font-mono text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"alex.smith\njane.doe\n..."}
          />
        </div>
        <button className="btn-primary w-full" disabled={loading || !text.trim()}>
          {loading ? <Spinner /> : "Import"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
        <div className="flex-1 border-t border-slate-800" />
        OR
        <div className="flex-1 border-t border-slate-800" />
      </div>

      <label className="btn-secondary w-full cursor-pointer">
        <Upload className="h-4 w-4" />
        Upload CSV
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={csv} />
      </label>
      <p className="mt-2 text-xs text-slate-500">
        CSV columns: <code>username</code> (required), <code>full_name</code>, <code>notes</code>,{" "}
        <code>tags</code>.
      </p>
    </Modal>
  );
}

function ScrapeModal({
  open,
  onClose,
  onSuccess,
  lists,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lists: ContactList[];
}) {
  const [target, setTarget] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [source, setSource] = useState<"followers" | "following">("followers");
  const [limit, setLimit] = useState(50);
  const [listId, setListId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
    enabled: open,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!accountId) {
      toast.error("Pick an account");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/contacts/scrape", {
        account_id: accountId,
        target_username: target.replace(/^@/, ""),
        source,
        limit,
        list_id: listId,
      });
      toast.success(`Imported ${r.data.length} contacts`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Scrape failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Scrape contacts from Instagram">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">From account</label>
          <select
            className="input"
            value={accountId ?? ""}
            onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
            required
          >
            <option value="">Select an account…</option>
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
          <label className="label">Target username</label>
          <input
            className="input"
            placeholder="e.g. nike"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Source</label>
            <select
              className="input"
              value={source}
              onChange={(e) => setSource(e.target.value as "followers" | "following")}
            >
              <option value="followers">Followers</option>
              <option value="following">Following</option>
            </select>
          </div>
          <div>
            <label className="label">Limit</label>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="label">Add to list (optional)</label>
          <select
            className="input"
            value={listId ?? ""}
            onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— None —</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : "Scrape"}
        </button>
      </form>
    </Modal>
  );
}

function CreateListModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/contact-lists", { name, description: description || null });
      toast.success("List created");
      setName("");
      setDescription("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create contact list">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Description</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : "Create"}
        </button>
      </form>
    </Modal>
  );
}
