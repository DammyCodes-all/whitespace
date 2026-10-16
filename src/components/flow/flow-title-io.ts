import type { Setter, TitleGift } from "@/components/flow/flow-types";
import type { WorkType } from "@/lib/types";

/** Plain fetch, no client timeout — slowness resolves as data or error. */
export async function chipFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(url, init);
}

/** Title-gift preview after an explicit check. Silent on failure. */
export async function fetchTitleTags(
  names: string[],
  wt: WorkType,
  pitchText: string,
  set: {
    setTitleTagsBusy: Setter<boolean>;
    setPreviewNote: Setter<string | null>;
    setTitleTags: Setter<TitleGift[]>;
    setCutGifts: Setter<TitleGift[]>;
    setShowCutGifts: Setter<boolean>;
    setTitleTagsDone: Setter<boolean>;
  },
) {
  if (names.length === 0) return;
  set.setTitleTagsBusy(true);
  try {
    const res = await chipFetch("/api/titles/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: names, workType: wt }),
    });
    const data = (await res.json()) as {
      tags?: TitleGift[];
      note?: unknown;
    };
    set.setPreviewNote(
      res.ok && typeof data.note === "string" ? data.note : null,
    );
    const valid =
      res.ok && Array.isArray(data.tags)
        ? data.tags.filter(
            (t) =>
              typeof t.qlooId === "string" &&
              t.qlooId.trim() !== "" &&
              typeof t.label === "string" &&
              t.label.trim() !== "",
          )
        : [];
    set.setTitleTags(valid);
    if (res.ok && Array.isArray(data.tags) && data.tags.length > 0) {
      try {
        const pickRes = await chipFetch("/api/titles/pick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pitchText,
            candidates: data.tags.map((t) => ({
              qlooId: t.qlooId,
              label: t.label,
              sourceTitleName: t.sourceTitleName,
            })),
          }),
        });
        const pick = (await pickRes.json()) as { keptIds?: unknown };
        if (
          pickRes.ok &&
          Array.isArray(pick.keptIds) &&
          pick.keptIds.length < data.tags.length
        ) {
          const keep = new Set(
            pick.keptIds.filter(
              (id): id is string => typeof id === "string" && id.trim() !== "",
            ),
          );
          set.setCutGifts(data.tags.filter((t) => !keep.has(t.qlooId)));
          set.setShowCutGifts(false);
          set.setTitleTags((prev) => prev.filter((t) => keep.has(t.qlooId)));
        } else {
          set.setCutGifts([]);
        }
      } catch {
        set.setCutGifts([]);
      }
    } else {
      set.setCutGifts([]);
    }
  } catch {
    set.setTitleTags([]);
    set.setCutGifts([]);
    set.setPreviewNote("preview-failed");
  } finally {
    set.setTitleTagsBusy(false);
    set.setTitleTagsDone(true);
  }
}

/** Entity-seeded suggestions off checked titles only. Silent on failure. */
export async function fetchTitleSuggestions(
  entityIds: string[],
  excludeNames: string[],
  wt: WorkType,
  set: {
    setQlooSuggestions: Setter<string[]>;
    setSuggestBusy: Setter<boolean>;
    setSuggestDone: Setter<boolean>;
  },
) {
  if (entityIds.length === 0) {
    set.setQlooSuggestions([]);
    set.setSuggestDone(true);
    return;
  }
  set.setSuggestBusy(true);
  try {
    const res = await chipFetch("/api/titles/related", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityIds, excludeNames, workType: wt }),
    });
    const data = (await res.json()) as { suggestions?: unknown };
    set.setQlooSuggestions(
      res.ok && Array.isArray(data.suggestions)
        ? data.suggestions.filter(
            (t): t is string => typeof t === "string" && t.trim() !== "",
          )
        : [],
    );
  } catch {
    set.setQlooSuggestions([]);
  } finally {
    set.setSuggestBusy(false);
    set.setSuggestDone(true);
  }
}
