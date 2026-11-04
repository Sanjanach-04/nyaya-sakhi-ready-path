import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Scale,
  MessageCircleHeart,
  BookOpenText,
  Landmark,
  FileEdit,
  HeartHandshake,
  PhoneCall,
  History,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import heroImage from "@/assets/hero.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nyaya Sakhi — AI Legal Assistant for Women" },
      {
        name: "description",
        content:
          "Know Your Rights. Find Your Support. Take Your Next Step. Nyaya Sakhi answers legal questions from verified Indian Acts with citations, explains government schemes, drafts complaints and puts emergency helplines one tap away.",
      },
      { property: "og:title", content: "Nyaya Sakhi — AI Legal Assistant for Women" },
      {
        property: "og:description",
        content:
          "Bridging the gap between women and reliable legal information through accessible, evidence-based AI assistance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: MessageCircleHeart,
    title: "AI Legal Assistant",
    text: "Ask any legal question in simple words. Get answers drawn only from verified Acts, with the exact Section cited.",
  },
  {
    icon: BookOpenText,
    title: "Know Your Rights",
    text: "Browse key Indian Acts and provisions explained in plain language, with the source of every explanation shown.",
  },
  {
    icon: Landmark,
    title: "Government Schemes",
    text: "Explore welfare schemes for women and check your eligibility with a short questionnaire.",
  },
  {
    icon: FileEdit,
    title: "Complaint & Application Helper",
    text: "Build a structured complaint or application step by step, review it, and download it as a PDF.",
  },
  {
    icon: HeartHandshake,
    title: "Legal Aid & Support",
    text: "Find NALSA and your State or District Legal Services Authority — official contacts only.",
  },
  {
    icon: PhoneCall,
    title: "Emergency Help",
    text: "Verified national helplines for women's safety, one tap to call, kept separate from the chatbot.",
  },
  {
    icon: History,
    title: "My Queries & History",
    text: "Your conversations, saved information and drafts stay private to your account, and you can delete them anytime.",
  },
];

const trustPoints = [
  { icon: ShieldCheck, label: "Answers only from verified legal sources" },
  { icon: Scale, label: "Act name & Section number on every answer" },
  { icon: Sparkles, label: "Simple language — no legal jargon required" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </span>
            <span className="font-display text-2xl leading-none">
              Nyaya Sakhi
              <span className="block text-xs font-sans font-medium tracking-wide text-muted-foreground">
                सत्य · साहस · सुरक्षा
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a
              href="#features"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Features
            </a>
            <a
              href="#safety"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              How it works
            </a>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="inline-flex h-9 items-center rounded-full border border-input bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              Login
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI legal literacy assistant for women
          </span>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Know Your Rights.
            <span className="block text-primary">Find Your Support.</span>
            Take Your Next Step.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Nyaya Sakhi bridges the gap between women and reliable legal information —
            plain-language explanations of your rights, verified government schemes,
            ready-to-use complaint drafts and instant access to emergency helplines.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35"
            >
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="inline-flex h-12 items-center rounded-full border border-input bg-card px-7 text-base font-medium transition-colors hover:bg-accent"
            >
              Login
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {trustPoints.map((p) => (
              <li key={p.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <p.icon className="h-4 w-4 text-accent-pink" />
                {p.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-4xl bg-secondary/50 blur-2xl" aria-hidden />
          <img
            src={heroImage}
            alt="Women accessing legal help and support"
            width={1024}
            height={768}
            className="relative w-full rounded-3xl border border-border/60 shadow-xl shadow-primary/10"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 pb-8 pt-6">
        <h2 className="font-display text-4xl">Everything in one place</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Seven guided tools that take you from "I don't know my rights" to a clear
          next step — written for people who have never read a legal document.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <article
              key={f.title}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  i % 3 === 1 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </article>
          ))}
          <article className="flex flex-col justify-between rounded-2xl bg-primary p-6 text-primary-foreground">
            <div>
              <h3 className="font-display text-2xl">Start with a question</h3>
              <p className="mt-2 text-sm leading-relaxed opacity-90">
                Describe your situation in your own words. Nyaya Sakhi finds the relevant
                law, explains it simply and tells you what you can do next.
              </p>
            </div>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-foreground/90"
            >
              Ask your first question
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>

      {/* How it works */}
      <section id="safety" className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-3xl border border-border/70 bg-secondary/60 p-8 sm:p-10">
          <h2 className="font-display text-4xl">How Nyaya Sakhi works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Describe your concern",
                text: "Type your question in English, Hindi or Kannada — no legal terms needed.",
              },
              {
                step: "2",
                title: "We check the verified law",
                text: "Your question is matched against a curated, verified corpus of Indian Acts. Only sufficiently reliable matches are used.",
              },
              {
                step: "3",
                title: "Get a cited answer & next step",
                text: "A simple explanation with the Act name and Section number, plus where to go for further help.",
              },
            ].map((s) => (
              <li key={s.step} className="relative rounded-2xl bg-card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-lg text-primary-foreground">
                  {s.step}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 rounded-xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Important:</strong> Nyaya Sakhi provides legal
            information, not legal advice. If the assistant cannot find sufficiently verified
            information, it will say so honestly and direct you to NALSA, your State Legal
            Services Authority, or a qualified lawyer. In an emergency, always call the
            helplines on the Emergency Help page.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-4 w-4" />
            </span>
            <span className="font-display text-lg">Nyaya Sakhi</span>
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            An AI-based legal assistant for women. Information only — not a substitute for
            advice from NALSA, a State Legal Services Authority, or a qualified lawyer.
          </p>
        </div>
      </footer>
    </div>
  );
}
