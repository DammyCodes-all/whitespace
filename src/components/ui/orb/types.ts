/**
 * Public types for the vendored orb widget.
 *
 * The widget is vendored from 21st.dev and slimmed for Whitespace; these
 * are the types the rest of the app drives it with (see
 * `src/components/orb/use-orb-*.ts`).
 */

export type OrbPhase =
  | "idle"
  | "launch"
  | "assemble"
  | "think"
  | "resolve"
  | "condense"
  | "unfold"
  | "answered"
  | "waiting"
  | "reset";
export type Phase = OrbPhase;

export interface MorphOrbProps {
  onSubmit?: (text: string) => Promise<string> | string;
  minThinkMs?: number;
  speed?: number;
  /** Real work line for the think phase ("Reading your pitch's
   *  tags…"). When set, it replaces the generic Thinking/Searching
   *  cycle — the label names only the call actually in flight. */
  workingLabel?: string;
  /** Copy for the hold state (default "Over to you."). */
  waitingLabel?: string;
  /** Ref drive for multi-leg flows: ask() runs one morph→think→receipt
   *  cycle around caller-supplied work; reset() returns to the idle pill. */
  orbRef?: React.Ref<OrbHandle | null>;
  /** Phase changes (OrbPhase); lets the host advance its own step UI
   *  when a leg's receipt lands. */
  onPhaseChange?: (phase: OrbPhase) => void;
}

/** Imperative drive for hosts that run several orb legs in a row. */
export interface OrbHandle {
  ask: (
    text: string,
    work: (text: string) => Promise<string> | string,
    end?: OrbEnd,
  ) => void;
  /** Think-only cycle around caller work: no box morph — the orb works
   *  from its current frame into think, then resolves. For mid-leg
   *  refreshes (Check). Returns false while a cycle is mid-flight. */
  pulse: (
    text: string,
    work: (text: string) => Promise<string> | string,
    end?: OrbEnd,
  ) => boolean;
  /** Between-leg advance beat: no cycle runs while the orb glides down
   *  and back, but the orb still holds its thinking pose for the whole
   *  window (`label` is the honest line for it) — and hands back to the
   *  waiting pose on `false`. Only applies to the settled waiting orb:
   *  a live cycle owns its own pose. */
  beat: (on: boolean, label?: string) => void;
  reset: () => void;
  /** Entry-leg controls for the ?pitch= autostart. */
  setText: (text: string) => void;
  submit: (text?: string, end?: OrbEnd) => void;
  /** Flight handoff: the clone already morphed card → ball in flight,
   *  so the runtime joins at the ball and grows to the orb (no replay). */
  submitFromBall: (text?: string, end?: OrbEnd) => void;
}

/** How a leg ends: a receipt card ("card"), a held orb waiting for
 *  input ("wait"), or a green flash dissolving into the result ("clear"). */
export type OrbEnd = "card" | "wait" | "clear";
