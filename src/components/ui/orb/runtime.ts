/**
 * The orb runtime: the imperative machine behind the animation.
 *
 * The React component owns the markup; this owns the state machine. It
 * holds the channel values, plays the timeline, moves the orb along the
 * flight path, blends between the resting poses, and ends every leg in
 * one of the three ways a leg can end (receipt card, held orb, green
 * flash).
 *
 * Nothing here talks to Qloo or to the app's data — the host hands it
 * a callback and it animates around it.
 */

import { ABORT, abortable, sleep } from "@/components/ui/orb/async";
import { createChannels } from "@/components/ui/orb/channels";
import { COPY } from "@/components/ui/orb/copy";
import { bez, clamp01, E, fmt } from "@/components/ui/orb/easing";
import {
  BALL_SMALL,
  BOX_R,
  CARD_H,
  cardW,
  homeDy,
  ORB_D,
  pillW,
} from "@/components/ui/orb/geometry";
import { followLabel } from "@/components/ui/orb/labels";
import { createOrb } from "@/components/ui/orb/orb-canvas";
import {
  createPoseBlender,
  HOLD_POSE,
  THINK_POSE,
} from "@/components/ui/orb/poses";
import {
  ASSEMBLE,
  CONDENSE,
  FADE,
  type Geo,
  INIT,
  launchBallTracks,
  launchTracks,
  R_CONDENSE,
  R_GREEN_OUT,
  R_IN,
  R_OUT,
  R_RESOLVE,
  RESOLVE,
  rCardIn,
  T,
  type Track,
  unfoldTracks,
} from "@/components/ui/orb/timeline";
import { createTrail } from "@/components/ui/orb/trail";
import type { OrbEnd, Phase } from "@/components/ui/orb/types";

export interface UI {
  setPhase(p: Phase): void;
  swapLabel(name: string): void;
  resetLabel(): void;
  setAnswer(s: string): void;
  clearInput(): void;
  live(s: string): void;
  lock(on: boolean): void;
  idleReady(): void;
  focusAnswer(): void;
}
export interface Env {
  root: HTMLElement;
  mover: HTMLElement;
  actor: HTMLElement;
  ghosts: HTMLElement[];
  canvas: HTMLCanvasElement;
  pulse: HTMLElement;
  status: HTMLElement;
  getBody: () => HTMLElement | null;
  /** Real work line while a leg runs, or null to cycle generic labels. */
  getWorkLabel: () => string | null;
  getWaitLabel: () => string;
  ui: UI;
  getSpeed: () => number;
  isReduced: () => boolean;
}
export interface RunCfg {
  onSubmit: (text: string) => Promise<string> | string;
  minThink: number;
  end: OrbEnd;
}
export interface Runtime {
  start(text: string, cfg: RunCfg): boolean;
  /** Join at the ball: clone already did card → ball, grow to orb. */
  startFromBall(text: string, cfg: RunCfg): boolean;
  /** Think-only: skip launch + assemble and work from the current
   *  (assembled) orb straight into think, then resolve. For mid-leg
   *  refreshes like Check that must never replay the box morph. */
  pulse(text: string, cfg: RunCfg): boolean;
  /** Between-leg beat: park the orb in its thinking pose while no cycle
   *  runs (see OrbHandle.beat). */
  beat(on: boolean, label?: string): void;
  escape(): void;
  reset(): void;
  hard(): void;
  home(): void;
  busy(): boolean;
  destroy(): void;
}
export function createRuntime(env: Env): Runtime {
  const { actor, root, status, pulse } = env;
  const life = new AbortController();
  const geo: Geo = { pw: pillW(), cw: cardW(), H: homeDy(), dir: -1 };
  const orb = createOrb(env.canvas, env.getSpeed, env.isReduced);
  const trail = createTrail(env.mover, env.ghosts);
  const vals: Record<string, number> = {};
  const dirty = new Set<string>();

  let current: AbortController | null = null;
  let idleCtl: AbortController | null = null;
  let beatCtl: AbortController | null = null;
  let busy = false,
    idling = false,
    settled = false,
    epoch = 0;
  let wStagger = 45,
    wDur = 320;

  const child = () => {
    const ac = new AbortController();
    if (life.signal.aborted) ac.abort();
    else
      life.signal.addEventListener("abort", () => ac.abort(), { once: true });
    return ac;
  };

  /** A cycle is taking the orb: stop any beat pose blend under it, so
   *  a stale blend can never write over the cycle's own tracks. */
  const stopBeat = () => {
    beatCtl?.abort();
    beatCtl = null;
    settled = false;
  };

  /* ── flight path ── */
  const applyPath = () => {
    const u = vals.u ?? 0,
      H = geo.H;
    trail.move(
      bez(u, 0, geo.dir * 0.3 * H, 0),
      bez(u, H, 0.6 * H, 0) + (vals.yOff ?? 0),
    );
  };

  /* ── answer words ── */
  const applyWords = (v: number) => {
    const body = env.getBody();
    if (!body) return;
    const nodes = body.querySelectorAll<HTMLElement>(".mo-w");
    const total = (nodes.length - 1) * wStagger + wDur;
    const time = v * total;
    const reduced = env.isReduced();
    nodes.forEach((el, i) => {
      const p = E.out(clamp01((time - i * wStagger) / wDur));
      el.style.opacity = fmt(p);
      el.style.transform =
        p >= 0.999 || reduced ? "none" : `translateY(${fmt((1 - p) * 4)}px)`;
      el.style.filter =
        p >= 0.999 || reduced ? "none" : `blur(${fmt((1 - p) * 4)}px)`;
    });
  };

  /* ── channels ── */
  const CH = createChannels({
    actor,
    root,
    status,
    pulse,
    orb,
    trail,
    applyPath,
    applyWords,
  });

  const set = (ch: string, v: number) => {
    vals[ch] = v;
    dirty.add(ch);
  };
  const flush = () => {
    dirty.forEach((ch) => CH[ch]?.(vals[ch]));
    dirty.clear();
  };
  const setNow = (ch: string, v: number) => {
    vals[ch] = v;
    CH[ch]?.(v);
  };
  const resetChannels = () => {
    setNow("w", geo.pw);
    for (const ch of Object.keys(INIT)) setNow(ch, INIT[ch]);
  };

  /* ── timeline engine ── */
  const play = (tracks: Track[], sig: AbortSignal) =>
    new Promise<void>((res) => {
      if (sig.aborted) return res();
      const end = tracks.reduce((m, k) => Math.max(m, k.t1), 0);
      const done = new Set<Track>();
      let raf = 0,
        t = 0,
        last = performance.now();
      const onAbort = () => {
        cancelAnimationFrame(raf);
        res();
      };
      const finish = () => {
        sig.removeEventListener("abort", onAbort);
        res();
      };
      const step = (now: number) => {
        const dt = Math.max(0, Math.min(100, now - last));
        last = now;
        t += dt * env.getSpeed();
        for (const k of tracks) {
          if (done.has(k) || t < k.t0) continue;
          const p = Math.min(1, (t - k.t0) / Math.max(1, k.t1 - k.t0));
          set(k.ch, k.from + (k.to - k.from) * (k.ease ?? E.io)(p));
          if (p === 1) done.add(k);
        }
        flush(); // one DOM write pass per frame
        if (t >= end) finish();
        else raf = requestAnimationFrame(step);
      };
      sig.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(step);
    });

  /* ── resting poses ── */
  const { toPose } = createPoseBlender({
    play,
    setNow,
    read: (key) => orb.P[key],
    isReduced: env.isReduced,
  });

  /* ── thinking labels ── */
  const labelFollower = {
    getWorkLabel: env.getWorkLabel,
    swapLabel: env.ui.swapLabel,
    live: env.ui.live,
    setProgram: (i: number) => {
      orb.P.prog = i;
    },
    getSpeed: env.getSpeed,
  };
  const labelFollow = (sig: AbortSignal, ctl: { stop: boolean }) =>
    followLabel(sig, ctl, labelFollower);

  /* ── orchestrator ── */
  const run = async (
    text: string,
    sig: AbortSignal,
    cfg: RunCfg,
    fromBall = false,
    quiet = false,
  ) => {
    const reduced = env.isReduced();
    const go = async (tracks: Track[]) => {
      await play(tracks, sig);
      if (sig.aborted) throw ABORT;
    };
    try {
      if (!quiet) {
        env.ui.setPhase("launch");
        trail.clear();
        if (!reduced) {
          if (fromBall) {
            await go(launchBallTracks());
          } else {
            await go(launchTracks(geo));
          }
          setNow("r", ORB_D / 2);
          env.ui.setPhase("assemble");
          await go(ASSEMBLE);
        } else {
          await go(R_OUT);
          setNow("u", 1);
          setNow("w", ORB_D);
          setNow("h", ORB_D);
          setNow("r", ORB_D / 2);
          setNow("sTy", 0);
          setNow("orb.k", 1);
          setNow("orb.spin", 0);
          env.ui.setPhase("assemble");
          await go(R_IN);
        }
      }
      /* Quiet starts skip the morph, so the caller's work line (set in
         the same tick the pulse is requested) is still one React commit
         away — yield a frame so the read below names the real call
         instead of falling into the generic label cycle. */
      if (quiet) {
        await abortable(
          new Promise<void>((r) => requestAnimationFrame(() => r())),
          sig,
        );
        if (sig.aborted) throw ABORT;
      }
      /* think — until the answer settled AND the minimum time elapsed */
      env.ui.setPhase("think");
      // Ink dots, working spin, the light programs back on: a quiet
      // pulse starts from the settled holding pose, so blend back to
      // the thinking pose here (no-op when a fresh cycle already is one).
      toPose(THINK_POSE, sig);
      const workLabel = env.getWorkLabel();
      if (workLabel !== null) {
        // Honest line: names the call actually in flight, no cycling.
        env.ui.swapLabel(workLabel);
        env.ui.live(workLabel);
      } else {
        orb.P.prog = 0;
        env.ui.swapLabel(COPY.labels[0]);
        env.ui.live(COPY.labels[0]);
      }
      const ctl = { stop: false };
      void labelFollow(sig, ctl);
      const t0 = performance.now();
      const pending = Promise.resolve()
        .then(() => cfg.onSubmit(text))
        .then(
          (b) => (typeof b === "string" && b.trim() ? b : COPY.answerBody),
          () => COPY.answerBody,
        );
      const got = await abortable(pending, sig);
      if (sig.aborted) throw ABORT;
      const body = got ?? COPY.answerBody;
      await sleep(
        cfg.minThink / env.getSpeed() - (performance.now() - t0),
        sig,
      );
      ctl.stop = true;
      if (sig.aborted) throw ABORT;

      /* Quiet legs never unfold a receipt card. "wait" plays the
         resolve sweep, then holds the orb with a nudge for input;
         "clear" plays resolve + the green condense flash, then
         dissolves everything so the result below takes over. */
      if (cfg.end !== "card") {
        env.ui.setPhase("resolve");
        // Legs end quietly: only the final leg ("clear") may print
        // Done. Mid-run legs keep the work line through the sweep,
        // then hand straight to the waiting nudge. Spec §5.
        if (cfg.end === "clear") env.ui.swapLabel(COPY.done);
        if (!reduced) {
          await go(RESOLVE);
        } else {
          await go(R_RESOLVE);
        }
        if (cfg.end === "wait") {
          env.ui.setPhase("waiting");
          const waitLabel = env.getWaitLabel();
          env.ui.swapLabel(waitLabel);
          env.ui.live(waitLabel);
          if (!reduced) setNow("orb.spin", 0.25);
          settled = true;
          return;
        }
        if (!reduced) {
          env.ui.setPhase("condense");
          await go(CONDENSE);
          await go(R_GREEN_OUT);
        } else {
          env.ui.setPhase("condense");
          await go(R_CONDENSE);
          await go(R_GREEN_OUT);
        }
        env.ui.setPhase("answered");
        env.ui.live(COPY.done);
        return;
      }

      const words = body.split(/\s+/).filter(Boolean);
      const n = Math.max(1, words.length);

      if (!reduced) {
        env.ui.setPhase("resolve");
        env.ui.swapLabel(COPY.done);
        await go(RESOLVE);

        env.ui.setPhase("condense");
        await go(CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 320;
        wStagger = n > 1 ? Math.min(45, 280 / (n - 1)) : 0;
        env.ui.setAnswer(body);
        await go(unfoldTracks(geo, (n - 1) * wStagger + wDur));
      } else {
        env.ui.setPhase("resolve");
        env.ui.swapLabel(COPY.done);
        await go(R_RESOLVE);
        await sleep(350 / env.getSpeed(), sig);
        if (sig.aborted) throw ABORT;

        env.ui.setPhase("condense");
        setNow("gs", 1);
        await go(R_CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 250;
        wStagger = 0;
        env.ui.setAnswer(body);
        await go(R_GREEN_OUT);
        setNow("w", geo.cw);
        setNow("h", CARD_H);
        setNow("r", BOX_R);
        setNow("dotS", 1);
        await go(rCardIn(wDur));
      }

      env.ui.setPhase("answered");
      env.ui.live("Answer ready: " + body);
      env.ui.focusAnswer();
    } catch (e) {
      if (e === ABORT) return;
      hard();
    }
  };

  /* ── return to the idle pill ── */
  const toIdle = async (kind: "reset" | "esc") => {
    if (idling) return;
    idling = true;
    stopBeat();
    const my = ++epoch;
    const ac = child();
    idleCtl = ac;
    const sig = ac.signal;
    const outMs = kind === "reset" ? 240 : 200;
    const inMs = kind === "reset" ? 420 : 200;
    env.ui.setPhase("reset");

    const out: Track[] = [T("cHalo", vals.cHalo ?? 0, 0, 0, outMs, E.out)];
    for (const ch of FADE) {
      const v = vals[ch] ?? 0;
      if (v > 0.001) out.push(T(ch, v, 0, 0, outMs, E.out));
    }
    if (kind === "reset") out.push(T("cs", 1, 0.98, 0, outMs, E.out));
    await play(out, sig);
    if (sig.aborted || my !== epoch) return;

    setNow("pulse", -1);
    env.ui.setAnswer("");
    env.ui.resetLabel();
    env.ui.clearInput();
    orb.reset();
    trail.clear();
    geo.pw = pillW();
    geo.cw = cardW();
    geo.H = homeDy();
    resetChannels();
    const pillCh = ["oPill", "oInput", "oGlow", "oAur", "oRing"];
    pillCh.forEach((ch) => setNow(ch, 0));
    setNow("yOff", kind === "reset" ? 8 : 0);
    const inn: Track[] = pillCh.map((ch) => T(ch, 0, 1, 0, inMs, E.out));
    if (kind === "reset") inn.push(T("yOff", 8, 0, 0, inMs, E.out));
    await play(inn, sig);
    if (sig.aborted || my !== epoch) return;

    resetChannels();
    current = null;
    idleCtl = null;
    busy = false;
    idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  };

  function hard() {
    epoch++;
    current?.abort();
    current = null;
    idleCtl?.abort();
    idleCtl = null;
    stopBeat();
    orb.reset();
    trail.clear();
    env.ui.setAnswer("");
    env.ui.resetLabel();
    geo.pw = pillW();
    geo.cw = cardW();
    geo.H = homeDy();
    resetChannels();
    setNow("pulse", -1);
    busy = false;
    idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  }

  /** Between-leg beat (see OrbHandle.beat): the host parks an advance
   *  while the orb glides down and back up; no cycle runs, so hold the
   *  thinking pose for the whole window — the glide never rides in the
   *  waiting colour. `false` hands back to the holding pose. Refused
   *  off the settled waiting orb: a live cycle owns its own pose. */
  function beat(on: boolean, label?: string) {
    if (!settled || idling) return;
    beatCtl?.abort();
    beatCtl = child();
    toPose(on ? THINK_POSE : HOLD_POSE, beatCtl.signal);
    if (on) orb.P.prog = 0;
    const line = on ? (label ?? COPY.waiting) : env.getWaitLabel();
    env.ui.swapLabel(line);
    env.ui.live(line);
  }

  resetChannels();

  return {
    start(text, cfg) {
      if (busy) return false;
      busy = true;
      stopBeat();
      geo.pw = pillW();
      geo.cw = cardW();
      geo.H = homeDy(); // snapshot once, never read layout in frames
      geo.dir = -geo.dir;
      orb.reset();
      setNow("u", 0);
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg);
      return true;
    },
    startFromBall(text, cfg) {
      if (busy) return false;
      busy = true;
      stopBeat();
      geo.pw = pillW();
      geo.cw = cardW();
      geo.H = homeDy();
      geo.dir = -geo.dir;
      orb.reset();
      // Ball state: what launchTracks leaves behind at the ink beat.
      setNow("w", BALL_SMALL);
      setNow("h", BALL_SMALL);
      setNow("r", BALL_SMALL / 2);
      setNow("oPill", 0);
      setNow("oBall", 1);
      setNow("oGlow", 0);
      setNow("oAur", 0);
      setNow("oInput", 0);
      setNow("u", 0);
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg, true);
      return true;
    },
    pulse(text, cfg) {
      // Take over from a settled cycle: the wait-end resolve returns
      // with busy still set (only hard()/toIdle clear it), yet no work
      // remains — release it here without touching the current frame,
      // so the orb thinks from exactly what is on screen. The ref
      // entry only allows this from waiting, where no cycle runs.
      stopBeat();
      busy = false;
      current?.abort();
      current = null;
      busy = true;
      // No reset, no launch: the orb is already assembled (waiting),
      // so work starts straight into think from the current frame.
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg, false, true);
      return true;
    },
    escape() {
      if (!busy || idling) return;
      current?.abort();
      void toIdle("esc");
    },
    reset() {
      if (!busy || idling) return;
      void toIdle("reset");
    },
    hard,
    beat,
    home() {
      if (busy) return;
      geo.pw = pillW();
      geo.cw = cardW();
      geo.H = homeDy();
      setNow("w", geo.pw);
      setNow("u", 0);
    },
    busy: () => busy,
    destroy() {
      life.abort();
      orb.destroy();
    },
  };
}
