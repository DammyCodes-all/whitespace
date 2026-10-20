import { EntryBox } from "@/components/entry-box";

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col px-6 pb-24 pt-12 sm:px-8 sm:pt-16">
        <div className="mx-auto my-auto flex w-full max-w-[960px] flex-col items-center">
          <h1 className="mx-auto max-w-[calc(100vw-3rem)] text-balance text-center font-serif text-[clamp(1.6rem,4.2vw,2.75rem)] leading-[1.15] tracking-tight">
            Every idea has a crowd. Find yours.
          </h1>

          <p className="mt-4 max-w-[38rem] text-pretty text-center text-body text-ink-2">
            Paste an idea. We tell you which audience it fits, how strongly, and
            where to find those people, and we show our work at every step.
          </p>

          <div className="mt-12 flex w-full max-w-[720px] flex-col">
            <EntryBox />

            <p className="mx-auto mt-8 max-w-[34rem] text-pretty text-center text-sm text-ink-3">
              Results are a hypothesis built from group-level taste data. They
              do not predict outcomes, and they never replace talking to real
              people.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
