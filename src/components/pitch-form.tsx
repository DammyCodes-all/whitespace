/**
 * Day 2 U: pitch form plus similar-to confirm (§6.1, §6.2).
 * Day 6.5 U: AI proposals (similar, words, rivals) plus pinned words.
 * Fixture-backed until the user taps "Suggest with AI", which POSTs to
 * `/api/propose` (keys stay server-side) and fills every section. Qloo
 * grounding happens at run time in the pipeline (§7, §8).
 *
 * Shell: owns state and the confirm step, composes the sections in
 * `./pitch-input.tsx`, `./nothing-like-input.tsx`,
 * `./similar-to-confirm.tsx`, `./candidate-words-confirm.tsx`,
 * `./rival-preview.tsx` and `./confirmed-audience.tsx`.
 */

"use client";

import { useRef, useState } from "react";
import { CandidateWordsConfirm } from "@/components/candidate-words-confirm";
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
import { fetchProposals } from "@/components/propose-client";
import { RivalPreview } from "@/components/rival-preview";
import { SimilarToConfirm } from "@/components/similar-to-confirm";
import type { ProposeRival } from "@/lib/agent/propose";
import {
  DEFAULT_CANDIDATE_WORDS,
  DEFAULT_RIVAL_PROPOSALS,
} from "@/lib/demo/proposal-defaults";
import type { Audience, ResolvedTitle, WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

export interface ConfirmInput {
  pitchText: string;
  workType: WorkType;
  nothingLike: string[];
  similarTitles: string[];
  candidateWords: string[];
  pinnedWords: string[];
  rivalProposals: ProposeRival[];
}

export function PitchForm({
  found,
  notFound,
  initialPitch = "",
  onConfirm,
}: {
  found: ResolvedTitle[];
  notFound: string[];
  initialPitch?: string;
  onConfirm?: (audience: Audience, input: ConfirmInput) => void;
}) {
  const [pitch, setPitch] = useState(initialPitch);
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
  const [confirmedHref, setConfirmedHref] = useState<string>("/run");
  const [candidateWords, setCandidateWords] = useState<string[]>(() => [
    ...DEFAULT_CANDIDATE_WORDS,
  ]);
  const [wordDraft, setWordDraft] = useState("");
  const [pinnedWords, setPinnedWords] = useState<string[]>([]);
  const [rivals, setRivals] = useState<ProposeRival[]>(() => [
    ...DEFAULT_RIVAL_PROPOSALS,
  ]);
  const [proposeLoading, setProposeLoading] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  // Work type the current suggestions were proposed for; a switch after
  // suggesting leaves stale proposals until the user suggests again.
  const [suggestedFor, setSuggestedFor] = useState<WorkType | null>(null);
  // Live mirrors for the post-fetch staleness check in suggest().
  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;
  const workTypeRef = useRef(workType);
  workTypeRef.current = workType;

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

  function handleWorkTypeChange(value: WorkType) {
    setWorkType(value);
    setConfirmed(null);
  }

  async function suggest() {
    if (pitch.trim() === "" || proposeLoading) return;
    // Snapshot: inputs lock while loading, and the response is applied
    // only when it still matches, closing the stale-pitch race.
    const requestedPitch = pitch.trim();
    const requestedType = workType;
    setProposeLoading(true);
    setProposeError(null);
    try {
      const result = await fetchProposals(requestedPitch, requestedType);
      if (
        requestedPitch !== pitchRef.current.trim() ||
        requestedType !== workTypeRef.current
      ) {
        setProposeError("Pitch changed while suggesting — suggest again.");
        return;
      }
      const aiSuggestions: Suggestion[] = result.similarTitles.map((name) => ({
        key: `ai-${name.toLowerCase()}`,
        name,
        found: true,
        proposed: true,
      }));
      setSuggestions((prev) => {
        // Merge, don't clobber: keep hand-added titles the AI didn't
        // repeat (AI wins exact duplicates).
        const aiNames = new Set(aiSuggestions.map((s) => s.name.toLowerCase()));
        const keptManual = prev.filter(
          (s) =>
            s.key.startsWith("added-") && !aiNames.has(s.name.toLowerCase()),
        );
        return [...aiSuggestions, ...keptManual];
      });
      setCandidateWords([...result.candidateWords]);
      setPinnedWords([]);
      setRivals([...result.rivalProposals]);
      setSuggestedFor(requestedType);
      setConfirmed(null);
    } catch (err) {
      setProposeError(err instanceof Error ? err.message : "Proposal failed.");
    } finally {
      setProposeLoading(false);
    }
  }

  function addWordDraft() {
    const word = wordDraft.trim().toLowerCase().replace(/\s+/g, " ");
    if (word === "") return;
    setCandidateWords((prev) =>
      prev.some((w) => w.toLowerCase() === word) ? prev : [...prev, word],
    );
    setWordDraft("");
    setConfirmed(null);
  }

  function togglePin(word: string) {
    const key = word.toLowerCase();
    setPinnedWords((prev) =>
      prev.some((w) => w.toLowerCase() === key)
        ? prev.filter((w) => w.toLowerCase() !== key)
        : [...prev, word],
    );
    setConfirmed(null);
  }

  function removeWord(word: string) {
    const key = word.toLowerCase();
    setCandidateWords((prev) => prev.filter((w) => w.toLowerCase() !== key));
    setPinnedWords((prev) => prev.filter((w) => w.toLowerCase() !== key));
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
    // The run grounds every title and word against Qloo, so the run input
    // carries all suggestion names (not just fixture matches) plus the
    // AI's words and rivals.
    const similarTitles = suggestions.map((s) => s.name);
    const pinnedKept = pinnedWords.filter((p) =>
      candidateWords.some((w) => w.toLowerCase() === p.toLowerCase()),
    );
    const runInput: ConfirmInput = {
      pitchText: trimmed,
      workType,
      nothingLike: nothingLikeKept,
      similarTitles,
      candidateWords: [...candidateWords],
      pinnedWords: pinnedKept,
      rivalProposals: rivals.map((r) => ({ ...r, titles: [...r.titles] })),
    };
    const href = `/run?input=${encodeURIComponent(JSON.stringify(runInput))}`;
    setConfirmed(audience);
    setConfirmedHref(href);
    onConfirm?.({ ...audience }, runInput);
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
        disabled={proposeLoading}
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
            onChange={(e) => handleWorkTypeChange(e.target.value as WorkType)}
            disabled={proposeLoading}
            className="mt-1 border border-rule bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-60"
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

      <div className="mt-4">
        <button
          type="button"
          onClick={suggest}
          disabled={pitch.trim() === "" || proposeLoading}
          className="border border-rule px-4 py-2 text-sm text-ink disabled:opacity-40"
        >
          {proposeLoading ? "Suggesting…" : "Suggest with AI"}
        </button>
        {proposeError && (
          <p className="mt-1 font-mono text-xs text-clay">{proposeError}</p>
        )}
        {suggestedFor !== null && suggestedFor !== workType && (
          <p className="mt-1 font-mono text-xs text-ink-2">
            Suggestions were made for {suggestedFor} — suggest again for{" "}
            {workType}.
          </p>
        )}
      </div>

      <SimilarToConfirm
        suggestions={suggestions}
        draft={draft}
        onDraftChange={setDraft}
        onAddDraft={addDraft}
        onRemove={removeSuggestion}
      />

      <CandidateWordsConfirm
        words={candidateWords}
        pinned={pinnedWords}
        draft={wordDraft}
        onDraftChange={setWordDraft}
        onAddDraft={addWordDraft}
        onTogglePin={togglePin}
        onRemove={removeWord}
      />

      <RivalPreview rivals={rivals} />

      <div className="mt-6">
        <button
          type="button"
          onClick={confirm}
          disabled={pitch.trim() === "" || suggestions.length === 0}
          className="inline-block bg-ink px-5 py-2.5 text-sm text-paper transition-colors transition-transform duration-150 ease-out hover:bg-ink-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-rule disabled:text-ink-3"
        >
          Confirm hypothesis audience
        </button>
      </div>

      {confirmed && (
        <ConfirmedAudience
          audience={confirmed}
          nothingLike={nothingLike}
          runHref={confirmedHref}
        />
      )}
    </section>
  );
}
