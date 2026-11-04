import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Download, FileEdit, Loader2, Save, RefreshCw } from "lucide-react";
import { api, isBackendStateError, type ComplaintTemplate } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n, LANGUAGES, type LanguageCode } from "@/i18n";
import { downloadDraftPdf } from "@/lib/draft-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/drafter")({
  head: () => ({
    meta: [
      { title: "Complaint & Application Helper — Nyaya Sakhi" },
      {
        name: "description",
        content: "Build a structured complaint or application step by step, review it, and download it as a PDF.",
      },
      { property: "og:title", content: "Complaint & Application Helper — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Build a structured complaint or application step by step, review it, and download it as a PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Drafter,
});

const STEPS = ["drafter.chooseTemplate", "drafter.details", "drafter.personal", "drafter.languageStep", "drafter.editDraft"] as const;

function Drafter() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<ComplaintTemplate | null>(null);
  const [incidentFields, setIncidentFields] = useState<Record<string, string>>({});
  const [personal, setPersonal] = useState({ name: "", address: "", phone: "", recipient: "" });
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");

  const templates = useQuery({
    queryKey: ["complaint-templates"],
    queryFn: () => api.complaints.templates(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const backendProblem = templates.isError && isBackendStateError(templates.error);

  const generate = useMutation({
    mutationFn: () =>
      api.complaints.generate({
        document_type: template!.type,
        fields: {
          ...incidentFields,
          applicant_name: personal.name,
          applicant_address: personal.address,
          applicant_phone: personal.phone,
          recipient: personal.recipient,
        },
        language,
      }),
    onSuccess: (res) => {
      setDraft(res.draft_content);
      setTitle(res.title || template!.title);
      setStep(4);
    },
    onError: (e) => {
      if (!isBackendStateError(e)) toast.error(t("common.errorGeneric"));
    },
  });

  const saveDraft = useMutation({
    mutationFn: () =>
      api.complaints.create({
        document_type: template!.type,
        title: title || template!.title,
        form_data: { ...incidentFields, ...personal },
        draft_content: draft,
        language,
      }),
    onSuccess: () => toast.success(t("drafter.saved")),
    onError: (e) => {
      if (!isBackendStateError(e)) toast.error(t("common.errorGeneric"));
    },
  });

  const downloadPdf = async () => {
    try {
      await downloadDraftPdf({ title: title || template?.title || "Draft", content: draft, language });
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };

  const canNext =
    step === 0
      ? !!template
      : !template
        ? false
        : step === 1
          ? template.fields
              .filter((f) => !f.personal)
              .every((f) => !f.required || (incidentFields[f.key] ?? "").trim())
          : step === 2
            ? !!(personal.name.trim() && personal.recipient.trim())
            : true;

  const stepper = (
    <ol className="flex flex-wrap gap-2" aria-label="Progress">
      {STEPS.map((key, i) => (
        <li key={key} className="flex items-center gap-2">
          <button
            type="button"
            disabled={i > step}
            onClick={() => setStep(i)}
            className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="font-display text-sm">{i + 1}</span>
            {t(key)}
          </button>
          {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
        </li>
      ))}
    </ol>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl bg-secondary/70 p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileEdit className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-4xl">{t("drafter.title")}</h1>
          <p className="mt-3 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground">
            {t("drafter.reviewBanner")}
          </p>
        </div>

        <div className="mt-6">{stepper}</div>

        {templates.isLoading && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}
        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState error={templates.error} />
          </div>
        )}

        {templates.data && (
          <div className="mt-8 rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
            {step === 0 && (
              <>
                <h2 className="font-display text-2xl">{t("drafter.chooseTemplate")}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {templates.data.map((tpl) => (
                    <button
                      key={tpl.type}
                      type="button"
                      onClick={() => {
                        setTemplate(tpl);
                        setStep(1);
                      }}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        template?.type === tpl.type
                          ? "border-primary bg-secondary/50"
                          : "border-border/70 hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{tpl.title}</span>
                        <Badge variant="secondary">{tpl.type}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{tpl.description}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && template && (
              <>
                <h2 className="font-display text-2xl">{t("drafter.details")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only your own words are used. Nyaya Sakhi never invents facts or dates for you.
                </p>
                <div className="mt-4 grid gap-4">
                  {template.fields
                    .filter((f) => !f.personal)
                    .map((f) => (
                      <div key={f.key}>
                        <label htmlFor={`f-${f.key}`} className="mb-1.5 block text-sm font-medium">
                          {f.label}{" "}
                          <span className={`text-xs ${f.required ? "text-destructive" : "text-muted-foreground"}`}>
                            ({f.required ? t("common.required") : t("common.optional")})
                          </span>
                        </label>
                        {f.multiline ? (
                          <Textarea
                            id={`f-${f.key}`}
                            rows={4}
                            value={incidentFields[f.key] ?? ""}
                            onChange={(e) => setIncidentFields((p) => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                          />
                        ) : (
                          <Input
                            id={`f-${f.key}`}
                            value={incidentFields[f.key] ?? ""}
                            onChange={(e) => setIncidentFields((p) => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                          />
                        )}
                      </div>
                    ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-display text-2xl">{t("drafter.personal")}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["name", "Your full name"],
                      ["phone", "Phone number (optional)"],
                      ["address", "Your address"],
                      ["recipient", "Submit to (e.g. Station House Officer, X Police Station)"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className={key === "address" || key === "recipient" ? "sm:col-span-2" : ""}>
                      <label htmlFor={`p-${key}`} className="mb-1.5 block text-sm font-medium">
                        {label}
                      </label>
                      {key === "address" || key === "recipient" ? (
                        <Textarea
                          id={`p-${key}`}
                          rows={2}
                          value={personal[key]}
                          onChange={(e) => setPersonal((p) => ({ ...p, [key]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          id={`p-${key}`}
                          value={personal[key]}
                          onChange={(e) => setPersonal((p) => ({ ...p, [key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="font-display text-2xl">{t("drafter.languageStep")}</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLanguage(l.code)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                        language === l.code
                          ? "border-primary bg-secondary/50 text-foreground"
                          : "border-border/70 hover:bg-muted/50"
                      }`}
                    >
                      {l.native}
                    </button>
                  ))}
                </div>
                <Button
                  className="mt-6"
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                >
                  {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                  {t("drafter.generate")}
                </Button>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="font-display text-2xl">{t("drafter.editDraft")}</h2>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Draft title"
                  className="mt-4"
                />
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={18}
                  aria-label={t("drafter.editDraft")}
                  className="mt-3 font-mono text-sm"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void downloadPdf()}>
                    <Download className="h-4 w-4" aria-hidden />
                    {t("drafter.downloadPdf")}
                  </Button>
                  <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
                    <Save className="h-4 w-4" aria-hidden />
                    {t("drafter.saveDraft")}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(3)}>
                    {t("drafter.regenerate")}
                  </Button>
                </div>
              </>
            )}

            {step > 0 && step < 4 && (
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  {t("common.back")}
                </Button>
                {step < 3 && (
                  <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                    {t("common.next")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
