// Vendored from 21st.dev (anark17r, "ai thiking orb and input") via MCP,
// then slimmed: this build keeps ONLY the orb animation and the morph
// (idle pill → ball → dotted orb → receipt). No text input, no send
// button, no reset button, no debug panel — entry lives on the landing
// page and the host drives legs through OrbHandle.
//
// Whitespace adaptations: the idle pill is the old pitch box (tall
// card, 16px corners); submit deforms it on the runtime's own w/h/r
// tracks; stage-relative geometry via measureStage.
//
// This file is the React shell only — the markup, the phase state and
// the imperative handle. The machine behind it lives beside it:
// `runtime.ts` (the state machine), `timeline.ts` (the tracks),
// `orb-canvas.ts` (the dots), `trail.ts`, `labels.ts`, `geometry.ts`,
// `easing.ts`, `async.ts`, `copy.ts` and `types.ts`.

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { COPY } from "@/components/ui/orb/copy";
import { measureStage } from "@/components/ui/orb/geometry";
import {
  createRuntime,
  type RunCfg,
  type Runtime,
} from "@/components/ui/orb/runtime";
import type { MorphOrbProps, OrbEnd, Phase } from "@/components/ui/orb/types";

/* ───────────────────────────── component ───────────────────────────── */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function MorphOrb(props: MorphOrbProps) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [lbl, setLbl] = useState<{
    cur: string;
    prev: string | null;
    n: number;
  }>({ cur: COPY.labels[0], prev: null, n: 0 });
  const [answer, setAnswer] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const phaseRef = useRef<Phase>("idle");
  const reducedRef = useRef(false);
  const rtRef = useRef<Runtime | null>(null);
  const textRef = useRef("");
  const workLabelRef = useRef<string | null>(null);
  const waitLabelRef = useRef("");

  const propsRef = useRef(props);
  propsRef.current = props;
  workLabelRef.current = props.workingLabel ?? null;
  waitLabelRef.current = props.waitingLabel ?? "";
  const speedRef = useRef(1);
  speedRef.current = props.speed ?? 1;

  useIsoLayoutEffect(() => {
    const root = rootRef.current,
      mover = moverRef.current,
      actor = actorRef.current,
      canvas = canvasRef.current;
    const pulse = pulseRef.current,
      status = statusRef.current;
    const ghosts = ghostRefs.current.filter((g): g is HTMLSpanElement => !!g);
    if (!root || !mover || !actor || !canvas || !pulse || !status) return;
    measureStage(root);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
    };
    mq.addEventListener("change", onMq);

    const rt = createRuntime({
      root,
      mover,
      actor,
      ghosts,
      canvas,
      pulse,
      status,
      getBody: () => bodyRef.current,
      getWorkLabel: () => workLabelRef.current,
      getWaitLabel: () => waitLabelRef.current || COPY.waiting,
      getSpeed: () => speedRef.current,
      isReduced: () => reducedRef.current,
      ui: {
        setPhase: (p) => {
          phaseRef.current = p;
          setPhaseState(p);
          propsRef.current.onPhaseChange?.(p);
        },
        swapLabel: (name) =>
          setLbl((l) =>
            l.cur === name ? l : { cur: name, prev: l.cur, n: l.n + 1 },
          ),
        resetLabel: () =>
          setLbl((l) => ({ cur: COPY.labels[0], prev: null, n: l.n + 1 })),
        setAnswer: (s) => setAnswer(s),
        clearInput: () => {
          textRef.current = "";
        },
        live: (s) => {
          if (liveRef.current) liveRef.current.textContent = s;
        },
        lock: () => {},
        idleReady: () => {},
        focusAnswer: () => {
          answerRef.current?.focus({ preventScroll: true });
        },
      },
    });
    rtRef.current = rt;

    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        phaseRef.current !== "idle" &&
        phaseRef.current !== "reset"
      ) {
        e.preventDefault();
        rt.escape();
      }
    };
    const onResize = () => {
      measureStage(rootRef.current);
      if (phaseRef.current === "idle" && !rt.busy()) rt.home();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMq);
      rt.destroy();
      rtRef.current = null;
    };
  }, []);

  const defaultSubmit = () =>
    new Promise<string>((res) => {
      window.setTimeout(() => res(COPY.answerBody), 4600 / speedRef.current);
    });
  const makeCfg = (end: OrbEnd = "card"): RunCfg => ({
    onSubmit: propsRef.current.onSubmit ?? defaultSubmit,
    minThink: propsRef.current.minThinkMs ?? 3450,
    end,
  });

  /* Ref-based under the hood (makeCfg reads propsRef at call time),
     so re-creation is identity churn only, never stale behaviour. */
  const submitText = (raw: string, end: OrbEnd = "card") => {
    const rt = rtRef.current;
    if (!rt || rt.busy() || phaseRef.current !== "idle") return;
    const text = raw.trim();
    if (text === "") return;
    textRef.current = text;
    rt.start(text, makeCfg(end));
  };

  const submitFromBallText = (raw: string, end: OrbEnd = "card") => {
    const rt = rtRef.current;
    if (!rt || rt.busy() || phaseRef.current !== "idle") return;
    const text = raw.trim();
    if (text === "") return;
    textRef.current = text;
    rt.startFromBall(text, makeCfg(end));
  };

  const words = answer.split(/\s+/).filter(Boolean);

  useImperativeHandle(
    props.orbRef,
    () => ({
      /* One orb cycle around caller work: hard-reset (sync, so a stale
         answered card never lingers), then start on the next frame.
         Refused while a cycle is mid-flight; allowed from
         answered/idle/waiting/reset. */
      ask: (text, work, end = "card") => {
        const rt = rtRef.current;
        if (!rt) return;
        const phase = phaseRef.current;
        if (
          phase !== "answered" &&
          phase !== "idle" &&
          phase !== "waiting" &&
          phase !== "reset"
        )
          return;
        rt.hard();
        textRef.current = text;
        const cfg: RunCfg = {
          onSubmit: () => work(text),
          minThink: propsRef.current.minThinkMs ?? 3450,
          end,
        };
        window.requestAnimationFrame(() => {
          rt.start(text, cfg);
        });
      },
      reset: () => {
        rtRef.current?.reset();
      },
      pulse: (text, work, end = "card") => {
        const rt = rtRef.current;
        if (!rt) return false;
        // Assembled orb only (waiting): from the pill or a receipt
        // card there is no orb frame to think from.
        if (phaseRef.current !== "waiting") return false;
        textRef.current = text;
        const cfg: RunCfg = {
          onSubmit: () => work(text),
          minThink: propsRef.current.minThinkMs ?? 3450,
          end,
        };
        return rt.pulse(text, cfg);
      },
      beat: (on, label) => {
        rtRef.current?.beat(on, label);
      },
      setText: (text: string) => {
        textRef.current = text;
      },
      submit: (text?: string, end: OrbEnd = "card") => {
        submitText(text ?? textRef.current, end);
      },
      submitFromBall: (text?: string, end: OrbEnd = "card") => {
        submitFromBallText(text ?? textRef.current, end);
      },
    }),
    [submitText],
  );

  const labelInner = (name: string) =>
    name === COPY.done ? (
      <span className="mo-lab-done">{name}</span>
    ) : (
      <>
        <span className="mo-lab-t">{name}</span>
        <span className="mo-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </>
    );

  return (
    <div className="mo-root" data-phase={phase} ref={rootRef}>
      <div className="mo-bg" aria-hidden="true" />
      <div className="mo-halo" aria-hidden="true" />

      <div className="mo-mover" ref={moverRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="mo-trail"
            aria-hidden="true"
            ref={(el) => {
              ghostRefs.current[i] = el;
            }}
          />
        ))}

        <div className="mo-actor" ref={actorRef}>
          <div className="mo-underglow" aria-hidden="true" />
          <div className="mo-halo-green" aria-hidden="true" />
          <div className="mo-surface" aria-hidden="true">
            <div className="mo-aurora">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="mo-ball" aria-hidden="true" />
          <div className="mo-green" aria-hidden="true" />
          <div className="mo-card" aria-hidden="true" />
          <div className="mo-ring" aria-hidden="true" />

          <canvas className="mo-orb" ref={canvasRef} aria-hidden="true" />
          <div className="mo-pulse" ref={pulseRef} aria-hidden="true" />

          <div
            className="mo-answer"
            ref={answerRef}
            tabIndex={-1}
            role="group"
            aria-label={COPY.answerTitle}
          >
            <div className="mo-a-head">
              <i className="mo-a-dot" aria-hidden="true" />
              <span>{COPY.answerTitle}</span>
            </div>
            <p className="mo-a-body" ref={bodyRef}>
              {words.map((w, i) => (
                <span key={i} className="mo-w">
                  {w}{" "}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="mo-status" ref={statusRef} aria-hidden="true">
        {lbl.prev !== null && (
          <span key={"p" + lbl.n} className="mo-lab mo-out">
            {labelInner(lbl.prev)}
          </span>
        )}
        <span key={"c" + lbl.n} className="mo-lab mo-in">
          {labelInner(lbl.cur)}
        </span>
      </div>

      <div className="mo-live" ref={liveRef} role="status" aria-live="polite" />
    </div>
  );
}
