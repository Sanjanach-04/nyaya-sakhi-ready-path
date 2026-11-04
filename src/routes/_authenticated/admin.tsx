import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Upload,
  Loader2,
  Check,
  X,
  RefreshCw,
  Users,
  MessageCircleHeart,
  FileEdit,
  AlertTriangle,
  ScrollText,
  Plus,
  Trash2,
} from "lucide-react";
import {
  api,
  isBackendStateError,
  type AdminDocument,
  type Scheme,
  type EmergencyContact,
  type LegalAidAuthority,
  type IngestionJob,
} from "@/lib/api";
import { AppShell, useMyRoles } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n } from "@/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Nyaya Sakhi" },
      {
        name: "description",
        content: "Manage legal documents, schemes, emergency helplines and legal aid data.",
      },
      { property: "og:title", content: "Admin — Nyaya Sakhi" },
      { property: "og:description", content: "Manage legal documents, schemes, helplines and legal aid data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const roles = useMyRoles();

  useEffect(() => {
    if (!roles.isLoading && roles.data && !roles.data.isAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [roles.isLoading, roles.data, navigate]);

  if (roles.isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (roles.data && !roles.data.isAdmin) {
    return (
      <AppShell>
        <p className="mx-auto max-w-md py-20 text-center text-sm text-muted-foreground">
          {t("admin.notAdmin")}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="font-display text-4xl">{t("admin.title")}</h1>
        </div>

        <Tabs defaultValue="documents" className="mt-8">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="documents">{t("admin.tab.documents")}</TabsTrigger>
            <TabsTrigger value="schemes">{t("admin.tab.schemes")}</TabsTrigger>
            <TabsTrigger value="emergency">{t("admin.tab.emergency")}</TabsTrigger>
            <TabsTrigger value="legal-aid">{t("admin.tab.legalAid")}</TabsTrigger>
            <TabsTrigger value="stats">{t("admin.tab.stats")}</TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab />
          </TabsContent>
          <TabsContent value="schemes" className="mt-4">
            <SchemesTab />
          </TabsContent>
          <TabsContent value="emergency" className="mt-4">
            <EmergencyTab />
          </TabsContent>
          <TabsContent value="legal-aid" className="mt-4">
            <LegalAidTab />
          </TabsContent>
          <TabsContent value="stats" className="mt-4">
            <StatsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const emptyDoc = {
  title: "",
  act_name: "",
  category: "general",
  version: "v1",
  language: "en",
  source_url: "",
};

function DocumentsTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyDoc);
  const [file, setFile] = useState<File | null>(null);
  const [replaceFileFor, setReplaceFileFor] = useState<string | null>(null);

  const documents = useQuery({
    queryKey: ["admin-documents"],
    queryFn: () => api.admin.documents(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });
  const jobs = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: () => api.admin.jobs(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["legal-acts"] });
  };

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (file) fd.append("file", file);
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      return api.admin.upload(fd);
    },
    onSuccess: () => {
      toast.success("Uploaded. The document stays pending until you approve it.");
      setForm(emptyDoc);
      setFile(null);
      invalidate();
    },
    onError: (e) => {
      if (!isBackendStateError(e)) toast.error(e instanceof Error ? e.message : t("common.errorGeneric"));
    },
  });

  const act = useMutation({
    mutationFn: async ({
      name,
      id,
    }: {
      name: "process" | "approve" | "reject";
      id: string;
    }): Promise<AdminDocument | IngestionJob> =>
      name === "process"
        ? api.admin.process(id)
        : name === "approve"
          ? api.admin.approve(id)
          : api.admin.reject(id),
    onSuccess: (res, { name }) => {
      if (name === "process") {
        const job = res as { status?: string; error?: string; chunks_created?: number };
        if (job.status === "failed") toast.error(job.error ?? "Processing failed");
        else toast.success(`Processed: ${job.chunks_created ?? 0} chunks embedded`);
      } else {
        toast.success(name === "approve" ? "Approved" : "Rejected");
      }
      invalidate();
    },
    onError: (e) => {
      if (!isBackendStateError(e)) toast.error(e instanceof Error ? e.message : t("common.errorGeneric"));
    },
  });

  const runAct = (name: "process" | "approve" | "reject", id: string) => act.mutate({ name, id });

  const replaceVersion = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.admin.replaceVersion(id, fd);
    },
    onSuccess: () => {
      toast.success("New version uploaded. Approve it after verifying the text.");
      setReplaceFileFor(null);
      invalidate();
    },
    onError: (e) => {
      if (!isBackendStateError(e)) toast.error(e instanceof Error ? e.message : t("common.errorGeneric"));
    },
  });

  const backendProblem = documents.isError && isBackendStateError(documents.error);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-card p-6">
        <h2 className="font-display text-xl">{t("admin.upload")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("admin.uploadHint")}</p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) upload.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="doc-file">PDF or TXT file</Label>
            <Input
              id="doc-file"
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1.5"
            />
          </div>
          {(Object.keys(emptyDoc) as (keyof typeof emptyDoc)[]).map((key) => (
            <div key={key}>
              <Label htmlFor={`doc-${key}`} className="capitalize">
                {key.replace(/_/g, " ")}
              </Label>
              <Input
                id={`doc-${key}`}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!file || upload.isPending}>
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              {t("admin.upload")}
            </Button>
          </div>
        </form>
      </section>

      {backendProblem && <BackendUnavailableState error={documents.error} />}
      {documents.data && (
        <section className="space-y-3">
          {(documents.data as AdminDocument[]).map((d) => (
            <article key={d.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{d.title}</h3>
                    <Badge
                      variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}
                    >
                      {d.status}
                    </Badge>
                    <Badge variant="outline">v{d.version.replace(/^v/, "")}</Badge>
                    <Badge variant="outline">{d.chunk_count} chunks</Badge>
                    {d.is_demo && <Badge variant="outline">Demo</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.act_name} · {d.category} · {d.language}
                    {d.file_path ? ` · ${d.file_path}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => runAct("process", d.id)} disabled={act.isPending && act.variables?.id === d.id}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.process")}
                  </Button>
                  <Button size="sm" onClick={() => runAct("approve", d.id)} disabled={d.status === "approved"}>
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.approve")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => runAct("reject", d.id)} disabled={d.status === "rejected"}>
                    <X className="h-3.5 w-3.5" aria-hidden />
                    {t("admin.reject")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplaceFileFor(replaceFileFor === d.id ? null : d.id)}>
                    {t("admin.replaceVersion")}
                  </Button>
                </div>
              </div>
              {replaceFileFor === d.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-3">
                  <Input
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) replaceVersion.mutate({ id: d.id, file: f });
                    }}
                    className="max-w-xs"
                  />
                  <span className="text-xs text-muted-foreground">The previous version is kept in version history.</span>
                </div>
              )}
            </article>
          ))}
          {documents.data.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          )}
        </section>
      )}

      {jobs.data && jobs.data.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="font-display text-lg">Recent ingestion jobs</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {jobs.data.slice(0, 8).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2">
                <Badge variant={j.status === "completed" ? "default" : j.status === "failed" ? "destructive" : "secondary"}>
                  {j.status}
                </Badge>
                <span>{j.chunks_created} chunks · {j.embeddings_created} embeddings</span>
                {j.error && <span className="text-destructive">{j.error}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schemes
// ---------------------------------------------------------------------------

const emptyScheme = {
  name: "",
  description: "",
  department: "",
  level: "central",
  state_name: "",
  category: "general",
  beneficiaries: "",
  benefits: "",
  required_documents: "",
  application_process: "",
  official_url: "",
  source_reference: "myScheme.gov.in",
  eligibility_json: "[]",
};

function SchemesTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyScheme);
  const [editingId, setEditingId] = useState<string | null>(null);

  const schemes = useQuery({
    queryKey: ["admin-schemes"],
    queryFn: () => api.schemes.list(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-schemes"] });

  const save = useMutation({
    mutationFn: () => {
      let eligibility: unknown;
      try {
        eligibility = JSON.parse(form.eligibility_json || "[]");
      } catch {
        throw new Error("Eligibility must be valid JSON, e.g. [{\"field\":\"gender\",\"values\":[\"female\"]}]");
      }
      const body = {
        name: form.name,
        description: form.description,
        department: form.department,
        level: form.level,
        state_name: form.state_name || null,
        category: form.category,
        beneficiaries: form.beneficiaries || null,
        benefits: form.benefits || null,
        required_documents: form.required_documents || null,
        application_process: form.application_process || null,
        official_url: form.official_url || null,
        source_reference: form.source_reference,
        eligibility,
      };
      return editingId ? api.admin.updateScheme(editingId, body) : api.admin.createScheme(body);
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      setForm(emptyScheme);
      setEditingId(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.errorGeneric")),
  });

  const verify = useMutation({
    mutationFn: (id: string) => api.admin.markSchemeVerified(id),
    onSuccess: () => {
      toast.success(t("admin.verified"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorGeneric")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.admin.deleteScheme(id),
    onSuccess: () => {
      toast.success(t("common.delete"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorGeneric")),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-card p-6">
        <h2 className="font-display text-xl">{editingId ? t("common.edit") : t("admin.add")} — {t("admin.tab.schemes")}</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {(
            [
              ["name", "Name"],
              ["department", "Department"],
              ["category", "Category"],
              ["state_name", "State (for state schemes)"],
              ["beneficiaries", "Beneficiaries"],
              ["official_url", "Official URL"],
              ["source_reference", "Source reference"],
              ["level", "Level (central/state)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label htmlFor={`s-${key}`}>{label}</Label>
              <Input
                id={`s-${key}`}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          ))}
          {(
            [
              ["description", "Description"],
              ["benefits", "Benefits"],
              ["required_documents", "Required documents"],
              ["application_process", "Application process"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="sm:col-span-2">
              <Label htmlFor={`s-${key}`}>{label}</Label>
              <Textarea
                id={`s-${key}`}
                rows={2}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label htmlFor="s-eligibility">Eligibility rules (JSON)</Label>
            <Textarea
              id="s-eligibility"
              rows={3}
              value={form.eligibility_json}
              onChange={(e) => setForm((f) => ({ ...f, eligibility_json: e.target.value }))}
              className="mt-1.5 font-mono text-xs"
              placeholder='[{"field":"gender","values":["female"]},{"field":"age_band","note":"18-40"}]'
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {t("common.save")}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyScheme);
                }}
              >
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </form>
      </section>

      {schemes.data && (
        <section className="space-y-3">
          {(schemes.data as Scheme[]).map((s) => (
            <article key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <Badge variant="secondary">{s.level}</Badge>
                  {s.is_demo && <Badge variant="outline">Demo</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(s.id);
                    setForm({
                      name: s.name,
                      description: s.description,
                      department: s.department,
                      level: s.level,
                      state_name: s.state_name ?? "",
                      category: s.category,
                      beneficiaries: s.beneficiaries ?? "",
                      benefits: s.benefits ?? "",
                      required_documents: s.required_documents ?? "",
                      application_process: s.application_process ?? "",
                      official_url: s.official_url ?? "",
                      source_reference: s.source_reference,
                      eligibility_json: JSON.stringify(s.eligibility, null, 0),
                    });
                  }}
                >
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => verify.mutate(s.id)}>
                  {t("admin.markVerified")}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Emergency
// ---------------------------------------------------------------------------

const emptyEmergency = {
  name: "",
  purpose: "",
  phone_number: "",
  availability: "",
  category: "national",
  source_reference: "Official government listing",
  display_order: "0",
};

function EmergencyTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyEmergency);
  const [editingId, setEditingId] = useState<string | null>(null);

  const contacts = useQuery({
    queryKey: ["admin-emergency"],
    queryFn: () => api.emergency.list(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-emergency"] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        purpose: form.purpose,
        phone_number: form.phone_number,
        availability: form.availability || null,
        category: form.category,
        source_reference: form.source_reference,
        display_order: Number(form.display_order) || 0,
      };
      return editingId ? api.admin.emergencyUpdate(editingId, body) : api.admin.emergencyCreate(body);
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      setForm(emptyEmergency);
      setEditingId(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.errorGeneric")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.admin.emergencyDelete(id),
    onSuccess: () => {
      toast.success(t("common.delete"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorGeneric")),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-card p-6">
        <h2 className="font-display text-xl">{editingId ? t("common.edit") : t("admin.add")} — {t("admin.tab.emergency")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Only official, published helpline numbers. Never invent numbers.</p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {(
            [
              ["name", "Name"],
              ["purpose", "Purpose"],
              ["phone_number", "Phone number"],
              ["availability", "Availability"],
              ["category", "Category"],
              ["source_reference", "Source reference"],
              ["display_order", "Display order"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label htmlFor={`e-${key}`}>{label}</Label>
              <Input
                id={`e-${key}`}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </section>

      {contacts.data && (
        <section className="space-y-3">
          {(contacts.data as EmergencyContact[]).map((c) => (
            <article key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <Badge variant="secondary">{c.category}</Badge>
                  {c.is_demo && <Badge variant="outline">Demo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.purpose} · {c.phone_number}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(c.id);
                    setForm({
                      name: c.name,
                      purpose: c.purpose,
                      phone_number: c.phone_number,
                      availability: c.availability ?? "",
                      category: c.category,
                      source_reference: c.source_reference,
                      display_order: String(c.display_order),
                    });
                  }}
                >
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legal aid
// ---------------------------------------------------------------------------

const emptyAuthority = {
  name: "",
  level: "state",
  state: "",
  district: "",
  address: "",
  phone: "",
  website: "",
  source_reference: "",
  last_verified_date: "",
};

function LegalAidTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyAuthority);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const authorities = useQuery({
    queryKey: ["legal-aid"],
    queryFn: () => api.legalAid.list(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["legal-aid"] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        level: form.level,
        state: form.state || null,
        district: form.district || null,
        address: form.address || null,
        phone: form.phone || null,
        website: form.website || null,
        source_reference: form.source_reference,
        last_verified_date: form.last_verified_date || null,
        is_demo: isDemo,
      };
      return editingId ? api.admin.legalAidUpdate(editingId, body) : api.admin.legalAidCreate(body);
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      setForm(emptyAuthority);
      setEditingId(null);
      setIsDemo(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.errorGeneric")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.admin.legalAidDelete(id),
    onSuccess: () => {
      toast.success(t("common.delete"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorGeneric")),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-card p-6">
        <h2 className="font-display text-xl">{editingId ? t("common.edit") : t("admin.add")} — {t("admin.tab.legalAid")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Official legal services authorities only, with source references.</p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {(
            [
              ["name", "Name"],
              ["level", "Level (national/state/district)"],
              ["state", "State"],
              ["district", "District"],
              ["phone", "Phone"],
              ["website", "Website URL"],
              ["source_reference", "Source reference"],
              ["last_verified_date", "Last verified (YYYY-MM-DD)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label htmlFor={`a-${key}`}>{label}</Label>
              <Input
                id={`a-${key}`}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label htmlFor="a-address">Address</Label>
            <Textarea
              id="a-address"
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch id="a-demo" checked={isDemo} onCheckedChange={setIsDemo} />
            <Label htmlFor="a-demo">Mark as demo entry (shown with a demo badge until verified)</Label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </section>

      {authorities.data && (
        <section className="space-y-3">
          {(authorities.data as LegalAidAuthority[]).map((a) => (
            <article key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{a.name}</h3>
                  <Badge variant="secondary">{a.level}</Badge>
                  {a.is_demo && <Badge variant="outline">Demo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{[a.state, a.district, a.phone].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(a.id);
                    setIsDemo(a.is_demo);
                    setForm({
                      name: a.name,
                      level: a.level,
                      state: a.state ?? "",
                      district: a.district ?? "",
                      address: a.address ?? "",
                      phone: a.phone ?? "",
                      website: a.website ?? "",
                      source_reference: a.source_reference,
                      last_verified_date: a.last_verified_date ?? "",
                    });
                  }}
                >
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function StatsTab() {
  const { t } = useI18n();
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.admin.stats(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const backendProblem = stats.isError && isBackendStateError(stats.error);

  const cards = [
    { icon: Users, label: "Registered users", value: stats.data?.users },
    { icon: MessageCircleHeart, label: "Conversations", value: stats.data?.chat_sessions },
    { icon: MessageCircleHeart, label: "Questions asked", value: stats.data?.questions },
    { icon: AlertTriangle, label: "Refusals (no verified source)", value: stats.data?.refusals },
    { icon: FileEdit, label: "Drafts created", value: stats.data?.drafts },
    { icon: ScrollText, label: "Approved documents", value: stats.data?.approved_documents },
    { icon: ScrollText, label: "Pending documents", value: stats.data?.pending_documents },
  ];

  return (
    <div>
      {backendProblem && <BackendUnavailableState error={stats.error} />}
      {stats.isError && !backendProblem && <p className="text-sm text-destructive">{t("common.errorGeneric")}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/70 bg-card p-5">
            <c.icon className="h-5 w-5 text-primary" aria-hidden />
            <p className="mt-3 font-display text-3xl">{c.value ?? "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      {stats.isLoading && <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>}
    </div>
  );
}
