import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryWord, namedAudienceLabel } from "./audience-words.ts";

describe("audience-words", () => {
  it("reads work types as the category noun a user would say", () => {
    assert.equal(categoryWord("film"), "Movies");
    assert.equal(categoryWord("music"), "Music");
    assert.equal(categoryWord("book"), "Books");
    assert.equal(categoryWord("game"), "Games");
  });

  it("labels the named audience by its source, with no (film) suffix", () => {
    assert.equal(
      namedAudienceLabel("film"),
      "People who like the Movies you named",
    );
    assert.equal(
      namedAudienceLabel("music"),
      "People who like the Music you named",
    );
  });
});
