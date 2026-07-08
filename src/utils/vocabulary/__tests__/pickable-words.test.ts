import { describe, expect, it } from "vitest"
import { extractPickableWords } from "../pickable-words"

describe("extractPickableWords", () => {
  it("splits latin sentences into deduplicated words", () => {
    expect(extractPickableWords("The quick brown fox jumps over the lazy dog"))
      .toEqual(["The", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"])
  })

  it("keeps apostrophes and hyphens inside words", () => {
    expect(extractPickableWords("It's a well-known fact"))
      .toEqual(["It's", "well-known", "fact"])
  })

  it("skips single letters and CJK tokens", () => {
    expect(extractPickableWords("I 喜欢 reading 英文 books a lot"))
      .toEqual(["reading", "books", "lot"])
  })

  it("returns empty for empty or null input", () => {
    expect(extractPickableWords("")).toEqual([])
    expect(extractPickableWords(null)).toEqual([])
  })
})
