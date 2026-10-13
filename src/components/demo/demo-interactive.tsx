"use client";

/**
 * Design-system showcase: the interactive islands.
 *
 * Only the tag-chips input takes callbacks, so it is the one client
 * boundary left on the page; everything else is a Server Component.
 * State starts from the same fixture the product screens use, so what
 * a reviewer edits here is the shape the app really passes.
 */

import { useState } from "react";
import { TagChips } from "@/components/tag-chips";
import { DEMO_TAG_CHIPS } from "@/lib/demo/design-system-data";
import type { FlowTag } from "@/lib/flow/contract";

export function TagChipsDemo() {
  const [tags, setTags] = useState<FlowTag[]>(DEMO_TAG_CHIPS);
  return <TagChips tags={tags} onChange={setTags} />;
}
