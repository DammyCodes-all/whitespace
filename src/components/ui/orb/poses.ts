/**
 * The orb's two resting looks.
 *
 * The orb has two resting looks: thinking (ink dots, working spin, the
 * light programs on) and holding (the orange nudge, programs off). A
 * leg ending leaves the holding pose on screen, so quiet work and the
 * between-leg beat blend the orb back to whichever pose the moment
 * implies.
 */

import { E } from "@/components/ui/orb/easing";
import { T, type Track } from "@/components/ui/orb/timeline";

export interface Pose {
  sweep: number;
  gain: number;
  floor: number;
  rad: number;
  spin: number;
}

/** Thinking: ink dots, working spin, the light programs on. */
export const THINK_POSE: Pose = {
  sweep: 0,
  gain: 1,
  floor: 0,
  rad: 0,
  spin: 0.9,
};

/** Holding: the orange nudge, programs off. */
export const HOLD_POSE: Pose = {
  sweep: 1,
  gain: 0,
  floor: 0.95,
  rad: 0.15,
  spin: 0.25,
};

const POSE_MS = 260;

export interface PoseBlender {
  /** Blend the orb into a pose; a no-op when it already sits there. */
  toPose(pose: Pose, sig: AbortSignal): void;
}

export function createPoseBlender({
  play,
  setNow,
  read,
  isReduced,
}: {
  play: (tracks: Track[], sig: AbortSignal) => Promise<void>;
  setNow: (ch: string, v: number) => void;
  /** The orb's current value for one pose key. */
  read: (key: keyof Pose) => number;
  isReduced: () => boolean;
}): PoseBlender {
  const toPose = (pose: Pose, sig: AbortSignal) => {
    if (isReduced()) {
      /* No spin under reduced motion (matches the wait ending). */
      for (const key of ["sweep", "gain", "floor", "rad"] as const)
        setNow("orb." + key, pose[key]);
      return;
    }
    const tracks: Track[] = [];
    for (const key of ["sweep", "gain", "floor", "rad"] as const) {
      const from = read(key);
      if (Math.abs(from - pose[key]) > 0.001)
        tracks.push(T("orb." + key, from, pose[key], 0, POSE_MS, E.io));
    }
    const spin = read("spin");
    if (Math.abs(spin - pose.spin) > 0.001)
      tracks.push(T("orb.spin", spin, pose.spin, 0, POSE_MS + 140, E.out));
    if (tracks.length === 0) return;
    void play(tracks, sig);
  };

  return { toPose };
}
