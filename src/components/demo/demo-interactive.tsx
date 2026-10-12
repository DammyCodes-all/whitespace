"use client";

/**
 * Design-system showcase: the interactive islands.
 *
 * Only the five inputs that take callbacks need a client boundary;
 * everything else on the page is a Server Component. State starts
 * from the same fixtures the product screens use, so what a reviewer
 * edits here is the shape the app really passes.
 */

import { useState } from "react";
import { CandidateWordsConfirm } from "@/components/candidate-words-confirm";
import { NothingLikeInput } from "@/components/nothing-like-input";
import type { Suggestion } from "@/components/pitch-form-utils";
import { PitchInput } from "@/components/pitch-input";
import { SimilarToConfirm } from "@/components/similar-to-confirm";
import { TagChips } from "@/components/tag-chips";
import {
  DEMO_NOTHING_LIKE,
  DEMO_PINNED,
  DEMO_PITCH_TEXT,
  DEMO_SUGGESTIONS,
  DEMO_TAG_CHIPS,
  DEMO_WORDS,
} from "@/lib/demo/design-system-data";
import type { FlowTag } from "@/lib/flow/contract";

export function TagChipsDemo() {
  const [tags, setTags] = useState<FlowTag[]>(DEMO_TAG_CHIPS);
  return <TagChips tags={tags} onChange={setTags} />;
}

export function PitchInputDemo() {
  const [pitch, setPitch] = useState(DEMO_PITCH_TEXT);
  return (
    <PitchInput pitch={pitch} onPitchChange={setPitch} wasTrimmed={false} />
  );
}

export function NothingLikeDemo() {
  const [values, setValues] = useState<string[]>(DEMO_NOTHING_LIKE);
  return (
    <NothingLikeInput
      values={values}
      onChangeAt={(i, value) =>
        setValues((prev) => prev.map((v, idx) => (idx === i ? value : v)))
      }
      onAdd={() => setValues((prev) => [...prev, ""])}
    />
  );
}

export function SimilarToDemo() {
  const [suggestions, setSuggestions] =
    useState<Suggestion[]>(DEMO_SUGGESTIONS);
  const [draft, setDraft] = useState("");
  return (
    <SimilarToConfirm
      suggestions={suggestions}
      draft={draft}
      onDraftChange={setDraft}
      onAddDraft={() => {
        const name = draft.trim();
        if (name === "") return;
        setSuggestions((prev) => [
          ...prev,
          { key: `added-${name.toLowerCase()}`, name },
        ]);
        setDraft("");
      }}
      onRemove={(key) =>
        setSuggestions((prev) => prev.filter((s) => s.key !== key))
      }
    />
  );
}

export function WordsDemo() {
  const [words, setWords] = useState<string[]>(DEMO_WORDS);
  const [pinned, setPinned] = useState<string[]>(DEMO_PINNED);
  const [draft, setDraft] = useState("");
  return (
    <CandidateWordsConfirm
      words={words}
      pinned={pinned}
      draft={draft}
      onDraftChange={setDraft}
      onAddDraft={() => {
        const word = draft.trim().toLowerCase().replace(/\s+/g, " ");
        if (word === "" || words.some((w) => w.toLowerCase() === word)) return;
        setWords((prev) => [...prev, word]);
        setDraft("");
      }}
      onTogglePin={(word) =>
        setPinned((prev) =>
          prev.some((w) => w.toLowerCase() === word.toLowerCase())
            ? prev.filter((w) => w.toLowerCase() !== word.toLowerCase())
            : [...prev, word],
        )
      }
      onRemove={(word) => {
        setWords((prev) =>
          prev.filter((w) => w.toLowerCase() !== word.toLowerCase()),
        );
        setPinned((prev) =>
          prev.filter((w) => w.toLowerCase() !== word.toLowerCase()),
        );
      }}
    />
  );
}
