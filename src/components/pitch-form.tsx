/**
 * Day 2 U: pitch form plus similar-to confirm (§6.1, §6.2).
 * Fixture-backed: suggestions come from U-owned demo mocks via props.
 * Live Qloo check wires in at the Day 6 seam; custom-added titles stay
 * listed as not-found until then. Nothing-like entries are collected for
 * the Day 5 exclusion audience and surfaced via `onConfirm`.
 *
 * Shell: owns state and the confirm step, composes the sections in
 * `./pitch-input.tsx`, `./nothing-like-input.tsx`,
 * `./similar-to-confirm.tsx` and `./confirmed-audience.tsx`.
 */

"use client";

import { useState } from "react";
import { ConfirmedAudience } from "@/components/confirmed-audience";
import { NothingLikeInput } from "@/components/nothing-like-input";
import type { Suggestion } from "@/components/pitch-form-utils";
import {
  countWords,
  NOTHING_LIKE_LIMIT,
  trimToWords,
  WORD_LIMIT,
} from "@/components/pitch-form-utils";
import { PitchInput } from "@/components/pitch-input";
import { SimilarToConfirm } from "@/components/similar-to-confirm";
import type { Audience, ResolvedTitle, WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

export function PitchForm({
  found,
  notFound,
  onConfirm,
}: {
  found: ResolvedTitle[];
  notFound: string[];
  onConfirm?: (
    audience: Audience,
    input: { pitchText: string; workType: WorkType; nothingLike: string[] },
  ) => void;
}) {
  const [pitch, setPitch] = useState("");
  const [workType, setWorkType] = useState<WorkType>("film");
  const [nothingLike, setNothingLike] = useState<string[]>([""]);
  const [wasTrimmed, setWasTrimmed] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => [
    ...found.map((t) => ({
      key: `found-${t.qlooId}`,
      name: t.name,
      found: true,
    })),
    ...notFound.map((t) => ({ key: `missing-${t}`, name: t, found: false })),
  ]);
  const [draft, setDraft] = useState("");
  const [confirmed, setConfirmed] = useState<Audience | null>(null);

  function setNothingLikeAt(index: number, value: string) {
    setNothingLike((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function addNothingLike() {
    setNothingLike((prev) =>
      prev.length >= NOTHING_LIKE_LIMIT ? prev : [...prev, ""],
    );
  }

  function removeSuggestion(key: string) {
    setSuggestions((prev) => prev.filter((s) => s.key !== key));
    setConfirmed(null);
  }

  function addDraft() {
    const name = draft.trim();
    if (name === "") return;
    setSuggestions((prev) => [
      ...prev,
      { key: `added-${name.toLowerCase()}`, name, found: false },
    ]);
    setDraft("");
    setConfirmed(null);
  }

  function confirm() {
    const kept = suggestions.filter((s) => s.found);
    const missing = suggestions.filter((s) => !s.found).map((s) => s.name);
    const trimmed =
      countWords(pitch) > WORD_LIMIT ? trimToWords(pitch, WORD_LIMIT) : pitch;
    setPitch(trimmed);
    setWasTrimmed(countWords(pitch) > WORD_LIMIT);
    // Titles resolve only from fixture data: a kept entry without a fixture
    // match falls back to not-found rather than inventing a Qloo id (§7).
    const titles: ResolvedTitle[] = [];
    const unmatched: string[] = [];
    for (const s of kept) {
      const match = found.find((t) => t.name === s.name);
      if (match === undefined) {
        unmatched.push(s.name);
      } else {
        titles.push({
          query: s.name,
          qlooId: match.qlooId,
          name: s.name,
          type: match.type,
        });
      }
    }
    const nothingLikeKept = nothingLike.map((v) => v.trim()).filter(Boolean);
    const audience: Audience = {
      id: "hyp",
      kind: "hypothesis",
      name: `Hypothesis (${workType})`,
      titles,
      notFoundTitles: [...missing, ...unmatched],
    };
    setConfirmed(audience);
    onConfirm?.(
      { ...audience },
      { pitchText: trimmed, workType, nothingLike: nothingLikeKept },
    );
  }

  return (
    <section
      aria-label="Pitch input"
      className="mt-8 border-t border-rule pt-8"
    >
      <p className="font-mono text-xs tracking-tight text-ink-3">
        §6.1 pitch input · §6.2 similar-to confirm
      </p>

      <PitchInput
        pitch={pitch}
        onPitchChange={setPitch}
        wasTrimmed={wasTrimmed}
      />

      <div className="mt-4 flex flex-wrap gap-4">
        <div>
          <label
            htmlFor="work-type"
            className="block font-mono text-xs text-ink-3"
          >
            Type of work
          </label>
          <select
            id="work-type"
            value={workType}
            onChange={(e) => setWorkType(e.target.value as WorkType)}
            className="mt-1 border border-rule bg-surface px-2 py-1.5 text-sm text-ink"
          >
            {WORK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <NothingLikeInput
          values={nothingLike}
          onChangeAt={setNothingLikeAt}
          onAdd={addNothingLike}
        />
      </div>

      <SimilarToConfirm
        suggestions={suggestions}
        draft={draft}
        onDraftChange={setDraft}
        onAddDraft={addDraft}
        onRemove={removeSuggestion}
      />

      <div className="mt-6">
        <button
          type="button"
          onClick={confirm}
          disabled={pitch.trim() === "" || suggestions.length === 0}
          className="inline-block bg-measured px-5 py-2.5 text-sm text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
        >
          Confirm hypothesis audience
        </button>
      </div>

      {confirmed && (
        <ConfirmedAudience audience={confirmed} nothingLike={nothingLike} />
      )}
    </section>
  );
}
