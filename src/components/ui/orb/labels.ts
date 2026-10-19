/**
 * The thinking label.
 *
 * The label follows the work line for the whole cycle, read live rather
 * than once at think start: a line that lands a commit after the pulse
 * (quiet starts), or one the caller steps forward as its chained calls
 * land, is picked up within a beat. The generic cycle is only the
 * no-line fallback.
 */

import { sleep } from "@/components/ui/orb/async";
import { COPY } from "@/components/ui/orb/copy";

export interface LabelFollower {
  /** The real work line, or null to cycle the generic labels. */
  getWorkLabel: () => string | null;
  /** Show a label on screen. */
  swapLabel: (name: string) => void;
  /** Announce the label to assistive tech. */
  live: (name: string) => void;
  /** Light program index for the orb dots (0-3). */
  setProgram: (index: number) => void;
  getSpeed: () => number;
}

const LABEL_POLL_MS = 110;

export async function followLabel(
  sig: AbortSignal,
  ctl: { stop: boolean },
  follower: LabelFollower,
): Promise<void> {
  let shown = follower.getWorkLabel() ?? COPY.labels[0];
  let i = 0;
  let cycledAt = performance.now();
  while (!sig.aborted && !ctl.stop) {
    await sleep(LABEL_POLL_MS, sig);
    if (sig.aborted || ctl.stop) return;
    const line = follower.getWorkLabel();
    if (line !== null) {
      if (line !== shown) {
        shown = line;
        follower.swapLabel(line);
        follower.live(line);
      }
      continue;
    }
    const now = performance.now();
    if (!COPY.labels.includes(shown)) {
      // A line was cleared (between-leg settle): cycle again.
      i = 0;
      shown = COPY.labels[0];
      cycledAt = now;
      follower.setProgram(0);
      follower.swapLabel(shown);
    } else {
      const beat = 1150 / follower.getSpeed();
      if (now - cycledAt < beat) continue;
      i = (i + 1) % COPY.labels.length;
      shown = COPY.labels[i];
      cycledAt = now;
      follower.setProgram(i % 4);
      follower.swapLabel(shown);
    }
  }
}
