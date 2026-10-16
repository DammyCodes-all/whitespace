import { FlowClient } from "@/components/flow-client";

/**
 * Package C: the flow page. Server shell, client flow.
 *
 * A pitch arriving via `?pitch=` (the landing text box) auto-starts
 * tag extraction, which also reads the pitch's type — there is no
 * type control anywhere. Without it the page opens on the input step.
 */

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function FlowPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const pitch = first(params.pitch).slice(0, 2000);
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <FlowClient initialPitch={pitch} autoStart={pitch.trim() !== ""} />
    </main>
  );
}
