import { ArrowUpRight, BookOpen, FileText, GitBranch, Quote } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: FileText,
    title: "Upload any paper",
    body: "PDFs, notes, images and CSVs. Tables, equations and figures are read, not skipped.",
  },
  {
    icon: GitBranch,
    title: "Diagrams that explain",
    body: "Answers come with diagrams that draw step by step, in the order the explanation goes.",
  },
  {
    icon: Quote,
    title: "Every claim cited",
    body: "Each answer points to the page and passage it came from, highlighted in the source.",
  },
  {
    icon: BookOpen,
    title: "At your level",
    body: "Beginner, intermediate or expert: the same idea, explained the way you need it.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 md:px-8">
          <Link href="/" aria-label="TensorLM home" className="rounded-sm">
            <Logo />
          </Link>
          <nav aria-label="Account" className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Start free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center md:px-8 md:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-3 py-1 text-caption font-medium text-graphite shadow-1">
            <span aria-hidden className="size-1.5 rounded-full bg-success" />
            Learn research papers with interactive diagrams
          </span>
          <h1 className="max-w-3xl text-display text-balance text-ink">Understand any research paper.</h1>
          <p className="max-w-xl text-body-read text-pretty text-graphite">
            Turn dense papers into clear explanations, diagrams that draw themselves, worked
            examples and quizzes, every claim tied back to the page it came from.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Upload a paper free</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/login">
                Sign in
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="features" className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-8">
          <h2 id="features" className="sr-only">
            What TensorLM does
          </h2>
          <div className="grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-3 bg-sheet p-6">
                <span className="flex size-9 items-center justify-center rounded-md border border-rule bg-subtle">
                  <Icon aria-hidden className="size-4 text-ink" />
                </span>
                <h3 className="text-h3 text-ink">{title}</h3>
                <p className="text-small text-graphite">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 text-caption text-graphite md:px-8">
          <span>TensorLM</span>
          <span className="flex gap-4">
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
