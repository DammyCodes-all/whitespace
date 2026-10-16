import {
  chipFetch,
  fetchTitleSuggestions,
  fetchTitleTags,
} from "@/components/flow/flow-title-io";
import type {
  CheckResult,
  Setter,
  TitleGift,
} from "@/components/flow/flow-types";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { WorkType } from "@/lib/types";

export interface TitleSetterBag {
  setCheckResult: Setter<CheckResult | null>;
  setTitleTags: Setter<TitleGift[]>;
  setCutGifts: Setter<TitleGift[]>;
  setShowCutGifts: Setter<boolean>;
  setPreviewNote: Setter<string | null>;
  setTitleTagsDone: Setter<boolean>;
  setSimilarTitles: Setter<string>;
}

export function addSuggestedTitle(
  title: string,
  similarTitles: string,
  set: TitleSetterBag,
) {
  const clean = title.trim();
  if (clean === "") return;
  const have = new Set(
    parseSimilarTitles(similarTitles).map((s) => s.toLowerCase()),
  );
  if (have.has(clean.toLowerCase())) return;
  resetTitleDerived(set);
  set.setSimilarTitles((prev) =>
    prev.trim() === "" ? clean : `${prev.replace(/\s*,\s*$/, "")}, ${clean}`,
  );
}

export function removeSimilarTitle(
  title: string,
  similarTitles: string,
  set: TitleSetterBag,
) {
  const keep = parseSimilarTitles(similarTitles).filter(
    (s) => s.toLowerCase() !== title.trim().toLowerCase(),
  );
  resetTitleDerived(set);
  set.setSimilarTitles(keep.join(", "));
}

export function resetTitleDerived(
  set: Omit<TitleSetterBag, "setSimilarTitles">,
) {
  set.setCheckResult(null);
  set.setTitleTags([]);
  set.setCutGifts([]);
  set.setShowCutGifts(false);
  set.setPreviewNote(null);
  set.setTitleTagsDone(false);
}

/** Explicit-click title check; previews gifts + suggestions on success. */
export async function checkSimilarTitlesAction(
  args: {
    similarTitles: string;
    workType: WorkType;
    pitchText: string;
    checkBusy: boolean;
  },
  set: TitleSetterBag & {
    setCheckBusy: Setter<boolean>;
    setCheckError: Setter<string | null>;
    setQlooSuggestions: Setter<string[]>;
    setSuggestBusy: Setter<boolean>;
    setSuggestDone: Setter<boolean>;
    setTitleTagsBusy: Setter<boolean>;
  },
) {
  const list = parseSimilarTitles(args.similarTitles);
  if (list.length === 0 || args.checkBusy) return;
  set.setCheckBusy(true);
  set.setCheckError(null);
  try {
    const res = await chipFetch("/api/titles/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: list, workType: args.workType }),
    });
    const data = (await res.json()) as {
      resolved?: { query: string; name: string; qlooId: string }[];
      notFound?: string[];
      error?: string;
    };
    if (!res.ok) {
      set.setCheckError(data.error ?? "Could not check the titles.");
      set.setCheckResult(null);
      return;
    }
    set.setCheckResult({
      resolved: Array.isArray(data.resolved) ? data.resolved : [],
      notFound: Array.isArray(data.notFound) ? data.notFound : [],
    });
    const resolvedNames = Array.isArray(data.resolved)
      ? data.resolved
          .map((r) => r.name)
          .filter((n): n is string => typeof n === "string" && n.trim() !== "")
      : [];
    set.setTitleTags([]);
    set.setCutGifts([]);
    set.setShowCutGifts(false);
    set.setPreviewNote(null);
    set.setTitleTagsDone(false);
    set.setQlooSuggestions([]);
    set.setSuggestDone(false);
    if (resolvedNames.length > 0) {
      void fetchTitleTags(resolvedNames, args.workType, args.pitchText, {
        setTitleTagsBusy: set.setTitleTagsBusy,
        setPreviewNote: set.setPreviewNote,
        setTitleTags: set.setTitleTags,
        setCutGifts: set.setCutGifts,
        setShowCutGifts: set.setShowCutGifts,
        setTitleTagsDone: set.setTitleTagsDone,
      });
      void fetchTitleSuggestions(
        Array.isArray(data.resolved)
          ? data.resolved
              .map((r) => r.qlooId)
              .filter(
                (id): id is string =>
                  typeof id === "string" && id.trim() !== "",
              )
          : [],
        parseSimilarTitles(args.similarTitles),
        args.workType,
        {
          setQlooSuggestions: set.setQlooSuggestions,
          setSuggestBusy: set.setSuggestBusy,
          setSuggestDone: set.setSuggestDone,
        },
      );
    } else {
      set.setTitleTagsDone(true);
      set.setSuggestDone(true);
    }
  } catch {
    set.setCheckError("Could not reach the title check.");
    set.setCheckResult(null);
  } finally {
    set.setCheckBusy(false);
  }
}
