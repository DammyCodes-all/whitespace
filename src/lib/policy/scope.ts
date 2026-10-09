/**
 * Day 11 S: scope gate. Owned by S.
 *
 * Pure logic, no Qloo calls, no AI. Tool/app pitches (bots, downloaders,
 * utilities) unite users by a behavior, not a taste — and Qloo's catalog
 * has no app/software entities to ground them to. Scoring them anyway
 * manufactures Weak verdicts that read as product failure but are really
 * category errors. So the pipeline refuses to score them: out-of-scope
 * pitches return Inconclusive with reason "scope" (§6.7) and the run page
 * renders an explained card instead of a fake run.
 *
 * Rule (deterministic, §10 #7): a tool-creation or utility-behavior
 * signal WITHOUT creative-work framing means out of scope. A film ABOUT
 * a bot ("a film about a hacker bot") stays in scope — the framing check
 * is what separates the tool from the story about the tool.
 *
 * Spec ref: §3 (users are film/music/book/game creators), §6.7
 * (Inconclusive is the honest answer), §10 #4 (no-data honesty).
 */

export interface ScopeCheck {
  inScope: boolean;
  /** Human-readable trigger, e.g. "bot" — for the explained card. */
  trigger?: string;
}

/** The thing being made is a utility, not a creative work. */
const TOOL_CREATION_RE =
  /\b(create|creates|creating|build|builds|building|make|makes|making|launch|launches|launching|develop|develops|developing|code|coding|ship|shipping|wanna create|want to build)\b[\s\S]{0,80}?\b(bot|bots|app|apps|application|applications|software|tool|tools|website|websites|platform|platforms|extension|extensions|plugin|plugins|downloader|uploader|scraper)\b/i;

/** Utility behavior: the pitch's point is getting around restrictions. */
const UTILITY_BEHAVIOR_RE =
  /\b(download\s+\w*\s*(media|video|videos|music|content)|without (the )?watermark|no\s*(watermark|restrictions)|remove\s+\w*\s*watermark|scrape|scraping|bulk\s*download)\b/i;

/** The pitch frames its idea as a creative work in our four types. */
const CREATIVE_FRAMING_RE =
  /\b(film|movie|cinema|album|track|song|soundtrack|novel|book|memoir|game|gameplay|story|stories|character|protagonist|drama|comedy|horror|thriller|romcom|documentary|series|episode|season|directed by|starring|set in|coming-of-age|about a \d+-year-old|novel about|film about|movie about)\b/i;

const TOOL_NOUN_RE =
  /\b(bot|bots|app|apps|application|software|tool|website|platform|extension|plugin|downloader)\b/i;

export function checkScope(pitchText: string): ScopeCheck {
  const text = pitchText.trim();
  if (text === "") return { inScope: true };
  // Creative framing wins: a story ABOUT a tool is still a story.
  if (CREATIVE_FRAMING_RE.test(text)) return { inScope: true };
  const creation = text.match(TOOL_CREATION_RE);
  if (creation !== null) {
    const noun = creation[2] ?? "tool";
    return { inScope: false, trigger: noun.toLowerCase() };
  }
  if (UTILITY_BEHAVIOR_RE.test(text) && TOOL_NOUN_RE.test(text)) {
    const noun = text.match(TOOL_NOUN_RE);
    return { inScope: false, trigger: noun?.[1]?.toLowerCase() ?? "tool" };
  }
  return { inScope: true };
}
