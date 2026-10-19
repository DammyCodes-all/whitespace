/**
 * Shape constants and stage measurement for the orb.
 *
 * The idle pill IS the old pitch box (tall card, 16px corners), so
 * submit deforms it — wide card → ball → orb — on the runtime's own
 * w/h/r tracks.
 */

import { BALL_D } from "@/components/orb/morph-geometry";

/* Whitespace adaptation: the idle pill IS the old pitch box (tall card,
   16px corners), so submit deforms it — wide card → ball → orb — on the
   runtime's own w/h/r tracks. */
export const PILL_H = 200,
  /** Join ball — shared with the flight clone (morph-geometry). */
  BALL_SMALL = BALL_D,
  ORB_D = 132,
  ORB_R = 66,
  CANVAS = 220;
export const BOX_R = 16;
export const CARD_H = 108;
export const FLY_D = 138;
/* The orb embeds in page flow (a bounded stage) instead of owning the
   viewport, so width derives from the stage's own size once mounted,
   falling back to the window before that. */
let stageW = 0;
export function measureStage(el: HTMLElement | null) {
  if (el) {
    stageW = el.clientWidth;
  }
}
const stageSpan = () => (stageW > 0 ? stageW : window.innerWidth) - 32;
export const pillW = () => Math.max(280, Math.min(720, stageSpan()));
export const cardW = () => Math.min(320, stageSpan());
/* Short flight: the box rests 80px below the orb anchor, so the stage
   stays compact. */
export const homeDy = () => 80;
