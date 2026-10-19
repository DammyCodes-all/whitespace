/**
 * One honest label for an evidence row. A keyless placeholder is never
 * "saved": no request ran, so it says mock (no key). Status 0 with no
 * mock flag is a failed request, not a cached success.
 *
 * Spec ref: §6.12 (status + cache honesty), §8 (no fake data).
 */

export interface EvidenceLike {
  status: number;
  fromCache: boolean;
  mock?: boolean;
}

/** "mock · no key", "no response", or "status 200". */
export function evidenceStatus(line: EvidenceLike): string {
  if (line.mock === true) return "mock · no key";
  if (line.status === 0) return "no response";
  return `status ${line.status}`;
}

/** " · saved" only for a real cache hit; never for a mock. */
export function evidenceCache(line: EvidenceLike): string {
  if (line.mock === true) return "";
  return line.fromCache ? " · saved" : "";
}
