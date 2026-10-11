import { FlowClient } from "@/components/flow-client";

/**
 * Package C: the flow page. Server shell, client flow.
 *
 * No fixture rendering here: fixtures for the two hard states live in
 * the API layer (documented), not on this page.
 */

export default function FlowPage() {
  return (
    <main className="flex flex-1 flex-col">
      <FlowClient />
    </main>
  );
}
