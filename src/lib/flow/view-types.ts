/**
 * Package C: the run-step shape the UI streams. Declared locally so the
 * client component never imports the server-only pipeline.
 *
 * `node --test` compatible: types only, relative `.ts` imports.
 */

export interface FlowStepRow {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
  /** §6.12: opens the Qloo call behind this step. */
  callId?: string;
}
