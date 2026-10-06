import { PitchFlow } from "@/components/pitch-flow";
import { mockAudiences } from "@/lib/demo/mock-run";

export default function Home() {
  const hypothesis = mockAudiences.find((a) => a.kind === "hypothesis");
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 sm:px-8">
        <p className="font-mono text-sm tracking-tight text-ink-2">
          Audience fit for creative work
        </p>

        <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          Before you ship, find out who it&rsquo;s actually for.
        </h1>

        <p className="mt-6 max-w-prose text-body text-ink-2">
          Paste an idea. We tell you which audience it fits, how strongly, and
          where to find those people, and we show our work at every step.
        </p>

        <PitchFlow
          found={hypothesis?.titles ?? []}
          notFound={hypothesis?.notFoundTitles ?? []}
        />

        <p className="mt-12 text-sm text-ink-3">
          Results are a hypothesis built from group-level taste data. They do
          not predict outcomes, and they never replace talking to real people.
        </p>
      </div>
    </main>
  );
}
