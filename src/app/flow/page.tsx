import { FlowClient } from "@/components/flow-client";
import type { WorkType } from "@/lib/types";

/**
 * Package C: the flow page. Server shell, client flow.
 *
 * A pitch arriving via `?pitch=` (the landing text box) auto-starts
 * tag extraction; without it the page opens on the input step.
 */

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

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
  const rawType = first(params.workType);
  const workType: WorkType = WORK_TYPES.includes(rawType as WorkType)
    ? (rawType as WorkType)
    : "film";
  return (
    <main className="flex flex-1 flex-col">
      <FlowClient
        initialPitch={pitch}
        initialWorkType={workType}
        autoStart={pitch.trim() !== ""}
      />
    </main>
  );
}
