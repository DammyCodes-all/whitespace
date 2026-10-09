import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkScope } from "./scope.ts";

describe("checkScope", () => {
  it("flags the telegram downloader bot as out of scope", () => {
    const r = checkScope(
      "Wanna create a telegram bot where people can download all sort of media from all sorts of social media without the watermark and no restrictions.",
    );
    assert.equal(r.inScope, false);
    assert.ok(r.trigger);
  });

  it("keeps a film pitch in scope", () => {
    assert.equal(
      checkScope(
        "A science-fiction drama set in space. A crew on a failing station must decide who returns to Earth.",
      ).inScope,
      true,
    );
  });

  it("keeps a story ABOUT a bot in scope (framing wins)", () => {
    assert.equal(
      checkScope(
        "A film about a lonely hacker who builds a bot to talk to his late brother. A drama about grief.",
      ).inScope,
      true,
    );
  });

  it("keeps music, book and game pitches in scope", () => {
    assert.equal(
      checkScope("A hushed ambient folk album recorded in a cabin.").inScope,
      true,
    );
    assert.equal(
      checkScope("A cozy fantasy novel about a bakery and dragons.").inScope,
      true,
    );
    assert.equal(
      checkScope("A cozy farming game about harvest and secrets.").inScope,
      true,
    );
  });

  it("flags build-an-app phrasing", () => {
    assert.equal(
      checkScope("I want to build an app that removes watermarks from videos.")
        .inScope,
      false,
    );
  });

  it("empty text stays in scope (nothing to judge yet)", () => {
    assert.equal(checkScope("").inScope, true);
  });
});
