import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Template } from "@/lib/types";
import { FullScreenSpinner, Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";

export function TemplatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data,
  });
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<Template | null>(null);

  if (isLoading) return <FullScreenSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Message templates</h1>
          <p className="text-sm text-slate-400">
            Use <code className="text-brand-400">{"{username}"}</code>,{" "}
            <code className="text-brand-400">{"{full_name}"}</code>,{" "}
            <code className="text-brand-400">{"{first_name}"}</code> and{" "}
            <code className="text-brand-400">{"{a|b|c}"}</code> spintax.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No templates yet"
          description="Create reusable message templates with variables and spintax."
          action={
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New template
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((t) => (
            <div key={t.id} className="card-pad flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{t.name}</div>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost"
                    onClick={() => setPreviewing(t)}
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setEditing(t)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <DeleteBtn t={t} qc={qc} />
                </div>
              </div>
              <p className="text-sm text-slate-400 whitespace-pre-wrap line-clamp-5 flex-1">
                {t.body}
              </p>
              {t.variants && (
                <div className="mt-2 text-xs text-slate-500">
                  + {t.variants.split("\n").filter(Boolean).length} variant(s)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <TemplateModal
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        template={editing}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["templates"] })}
      />
      <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}

function DeleteBtn({
  t,
  qc,
}: {
  t: Template;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const del = useMutation({
    mutationFn: async () => (await api.delete(`/templates/${t.id}`)).data,
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
  return (
    <button
      className="btn-ghost text-red-400"
      onClick={() => {
        if (confirm(`Delete template "${t.name}"?`)) del.mutate();
      }}
      title="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function TemplateModal({
  open,
  onClose,
  template,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  template: Template | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [variants, setVariants] = useState(template?.variants ?? "");
  const [loading, setLoading] = useState(false);

  // re-init when template prop changes
  if (template && template.id !== (window as any)._lastTplId) {
    (window as any)._lastTplId = template.id;
    setName(template.name);
    setBody(template.body);
    setVariants(template.variants ?? "");
  } else if (!template && (window as any)._lastTplId !== null) {
    (window as any)._lastTplId = null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (template) {
        await api.patch(`/templates/${template.id}`, { name, body, variants: variants || null });
        toast.success("Updated");
      } else {
        await api.post("/templates", { name, body, variants: variants || null });
        toast.success("Created");
      }
      setName("");
      setBody("");
      setVariants("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "Edit template" : "New template"}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Message body</label>
          <textarea
            className="input min-h-[140px] font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hey {first_name} 👋, {great|awesome|nice} to connect!"}
            required
          />
        </div>
        <div>
          <label className="label">Variants (one per line, optional)</label>
          <textarea
            className="input min-h-[100px] font-mono text-xs"
            value={variants}
            onChange={(e) => setVariants(e.target.value)}
            placeholder={"Hi {first_name}, hope you're well!\nHey {first_name}, quick question:"}
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : template ? "Save" : "Create"}
        </button>
      </form>
    </Modal>
  );
}

function PreviewModal({
  template,
  onClose,
}: {
  template: Template | null;
  onClose: () => void;
}) {
  const [rendered, setRendered] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function preview() {
    if (!template) return;
    setLoading(true);
    try {
      const out: string[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await api.post(`/templates/${template.id}/preview`, {
          username: "alex.smith",
          full_name: "Alex Smith",
          first_name: "Alex",
        });
        out.push(r.data.rendered);
      }
      setRendered(out);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={!!template}
      onClose={() => {
        setRendered([]);
        onClose();
      }}
      title={`Preview · ${template?.name ?? ""}`}
      size="lg"
    >
      <p className="text-sm text-slate-400 mb-3">
        Sample render with <code>username=alex.smith</code>, <code>full_name=Alex Smith</code>.
      </p>
      <button className="btn-primary mb-4" onClick={preview} disabled={loading}>
        {loading ? <Spinner /> : "Generate 5 samples"}
      </button>
      <div className="space-y-2">
        {rendered.map((r, i) => (
          <div key={i} className="card px-3 py-2 text-sm whitespace-pre-wrap">
            {r}
          </div>
        ))}
      </div>
    </Modal>
  );
}
