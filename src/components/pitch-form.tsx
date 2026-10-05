"use client";

import Link from "next/link";
import { useState } from "react";
import type { Audience, ResolvedTitle, WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/** §6.1: long pitches trim to roughly 300 words, with a notice. */
const WORD_LIMIT = 300;

/** §6.1: up to five "nothing like" titles. */
const NOTHING_LIKE_LIMIT = 5;

interface Suggestion {
  key: string;
  name: string;
  found: boolean;
}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return text.trim() === "" ? 0 : words.length;
}

function trimToWords(text: string, limit: number): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, limit).join(" ");
}

/**
 * Day 2 U: pitch form plus similar-to confirm (§6.1, §6.2).
 * Fixture-backed: suggestions come from U-owned demo mocks via props.
 * Live Qloo check wires in at the Day 6 seam; custom-added titles stay
 * listed as not-found until then. Nothing-like entries are collected for
 * the Day 5 exclusion audience and surfaced via `onConfirm`.
 */
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

  const words = countWords(pitch);

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

      <label
        htmlFor="pitch"
        className="mt-4 block text-lg tracking-tight text-ink"
      >
        Paste your idea
      </label>
      <textarea
        id="pitch"
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        rows={5}
        required
        placeholder="A quiet science-fiction film about a lonely worker on a space station."
        className="mt-2 w-full border border-rule bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-ink-3"
      />
      <p data-numeric className="mt-1 font-mono text-xs text-ink-3">
        {words} / {WORD_LIMIT} words
        {words > WORD_LIMIT && " · will trim on confirm"}
      </p>
      {wasTrimmed && (
        <p className="mt-1 font-mono text-xs text-ink-2">
          Trimmed to {WORD_LIMIT} words.
        </p>
      )}

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
        <fieldset className="min-w-0 flex-1">
          <legend className="font-mono text-xs text-ink-3">
            Nothing like (up to {NOTHING_LIKE_LIMIT}, optional)
          </legend>
          {nothingLike.map((value, i) => (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots, order never changes
              key={i}
              value={value}
              onChange={(e) => setNothingLikeAt(i, e.target.value)}
              placeholder={`Nothing like #${i + 1}`}
              aria-label={`Nothing like ${i + 1}`}
              className="mt-1 w-full border border-rule bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-3"
            />
          ))}
          {nothingLike.length < NOTHING_LIKE_LIMIT && (
            <button
              type="button"
              onClick={addNothingLike}
              className="mt-2 font-mono text-xs text-measured underline underline-offset-4"
            >
              + add another
            </button>
          )}
        </fieldset>
      </div>

      <h3 className="mt-8 text-lg tracking-tight text-ink">
        Similar to — confirm the list
      </h3>
      <p className="mt-1 font-mono text-xs text-ink-3">
        Checked against fixture data for Day 2; live Qloo check lands with the
        Day 6 seam.
      </p>
      <ul className="mt-3 border-t border-rule">
        {suggestions.map((s) => (
          <li
            key={s.key}
            className="flex items-baseline justify-between gap-4 border-b border-rule py-2"
          >
            <p className="text-[15px] text-ink">
              {s.name}{" "}
              <span
                className={
                  s.found
                    ? "font-mono text-xs text-measured"
                    : "font-mono text-xs text-clay"
                }
              >
                {s.found ? "found" : "not found in Qloo"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => removeSuggestion(s.key)}
              aria-label={`Remove ${s.name}`}
              className="shrink-0 font-mono text-xs text-ink-3 underline underline-offset-4 hover:text-ink"
            >
              remove
            </button>
          </li>
        ))}
        {suggestions.length === 0 && (
          <li className="border-b border-rule py-2 font-mono text-xs text-ink-3">
            List is empty — add titles below or confirm with none.
          </li>
        )}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a similar title"
          aria-label="Add a similar title"
          className="min-w-0 flex-1 border border-rule bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={addDraft}
          className="shrink-0 border border-rule px-3 py-1.5 text-sm text-ink"
        >
          Add
        </button>
      </div>

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
        <div className="mt-6 border border-rule bg-surface p-4">
          <p className="font-mono text-xs tracking-tight text-ink-3">
            hypothesis audience · §6.2
          </p>
          <p className="mt-1 font-serif text-base text-ink">
            {confirmed.titles.length} titles kept
            {confirmed.notFoundTitles.length > 0 &&
              `, ${confirmed.notFoundTitles.length} not found: ${confirmed.notFoundTitles.join(", ")}`}
          </p>
          {nothingLike.some((v) => v.trim() !== "") && (
            <p className="mt-1 font-mono text-xs text-ink-2">
              Nothing like:{" "}
              {nothingLike
                .map((v) => v.trim())
                .filter(Boolean)
                .join(", ")}{" "}
              · feeds the Day 5 exclusion step.
            </p>
          )}
          <Link
            href="/run"
            className="mt-3 inline-block bg-measured px-5 py-2.5 text-sm text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            See a sample run
          </Link>
        </div>
      )}
    </section>
  );
}
