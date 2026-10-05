import { PitchForm } from "@/components/pitch-form";
import { mockAudiences } from "@/lib/demo/mock-run";

const principles = [
  {
    title: "Your guess is a hypothesis, not a fact",
    body: "We build rival readings of the same pitch and unrelated controls, then compare all of them against your hypothesis audience.",
    ref: "§6.2, §6.3, §6.4",
  },
  {
    title: "Every claim links to the Qloo call behind it",
    body: "Titles, tags and tastes come from taste data or they do not appear on screen. Open any number to see what was asked and what came back.",
    ref: "§6.12, §7",
  },
  {
    title: "When the data is missing, we say so",
    body: '"No data" is not a low score. We would rather tell you we cannot judge than hand you a number that means nothing.',
    ref: "§6.6, §6.7",
  },
];

export default function Home() {
  const hypothesis = mockAudiences.find((a) => a.kind === "hypothesis");
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 sm:px-8">
        <p className="font-mono text-sm tracking-tight text-ink-3">
          Whitespace
        </p>

        <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          Before you ship, find out who it&rsquo;s actually for.
        </h1>

        <p className="mt-6 max-w-prose text-body text-ink-2">
          Paste an idea. We tell you which audience it fits, how strongly, and
          where to find those people, and we show our work at every step.
        </p>

        <PitchForm
          found={hypothesis?.titles ?? []}
          notFound={hypothesis?.notFoundTitles ?? []}
        />

        <div className="mt-16 border-t border-rule">
          {principles.map((principle) => (
            <section
              key={principle.ref}
              className="border-b border-rule py-8 sm:flex sm:gap-8"
            >
              <p className="font-mono text-xs text-ink-3 sm:w-24 sm:shrink-0 sm:pt-1">
                {principle.ref}
              </p>
              <div className="mt-2 sm:mt-0">
                <h2 className="text-lg tracking-tight text-ink">
                  {principle.title}
                </h2>
                <p className="mt-2 max-w-prose text-body text-ink-2">
                  {principle.body}
                </p>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm text-ink-3">
          Results are a hypothesis built from group-level taste data. They do
          not predict outcomes, and they never replace talking to real people.
        </p>
      </div>
    </main>
  );
}
