import { PitchFlow } from "@/components/pitch-flow";
import { mockAudiences } from "@/lib/demo/mock-run";

export default function Home() {
  const hypothesis = mockAudiences.find((a) => a.kind === "hypothesis");
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col px-6 pb-12 pt-24 sm:px-8">
        <div className="mx-auto flex w-full max-w-[720px] flex-col">
          <h1 className="text-center font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            Every idea has a crowd. Most miss theirs.
          </h1>

          <p className="mx-auto mt-6 max-w-[38rem] text-center text-body text-ink-2">
            Paste an idea. We tell you which audience it fits, how strongly, and
            where to find those people, and we show our work at every step.
          </p>

          <PitchFlow
            found={hypothesis?.titles ?? []}
            notFound={hypothesis?.notFoundTitles ?? []}
          />

          <p className="mt-10 text-center text-sm text-ink-3">
            Results are a hypothesis built from group-level taste data. They do
            not predict outcomes, and they never replace talking to real people.
          </p>
        </div>
      </div>
    </main>
  );
}
