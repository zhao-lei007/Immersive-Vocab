import type { VocabularyWord } from "@/types/vocabulary"
import { describe, expect, it } from "vitest"
import { isWordRecordChanged, mergeWordRecords } from "../merge"

function makeWord(overrides: Partial<VocabularyWord> = {}): VocabularyWord {
  return {
    id: "local-id",
    word: "ephemeral",
    translation: "短暂的",
    createdAt: 1000,
    dueAt: 2000,
    intervalDays: 1,
    reviewCount: 1,
    ...overrides,
  }
}

describe("mergeWordRecords", () => {
  it("takes review state from the record with more reviews", () => {
    const local = makeWord({ reviewCount: 1, intervalDays: 1, dueAt: 2000, lastReviewedAt: 500 })
    const incoming = makeWord({ id: "remote-id", reviewCount: 3, intervalDays: 4, dueAt: 9000, lastReviewedAt: 800 })

    const merged = mergeWordRecords(local, incoming)

    expect(merged.id).toBe("local-id")
    expect(merged.reviewCount).toBe(3)
    expect(merged.intervalDays).toBe(4)
    expect(merged.dueAt).toBe(9000)
    expect(merged.lastReviewedAt).toBe(800)
  })

  it("breaks review-count ties by last reviewed time", () => {
    const local = makeWord({ reviewCount: 2, dueAt: 5000, lastReviewedAt: 900 })
    const incoming = makeWord({ reviewCount: 2, dueAt: 3000, lastReviewedAt: 100 })

    expect(mergeWordRecords(local, incoming).dueAt).toBe(5000)
  })

  it("fills empty enrichment fields from the other side and keeps earliest createdAt", () => {
    const local = makeWord({ phonetic: undefined, example: "local example", createdAt: 5000 })
    const incoming = makeWord({ phonetic: "/əˈfem(ə)rəl/", example: "remote example", createdAt: 1000 })

    const merged = mergeWordRecords(local, incoming)

    expect(merged.phonetic).toBe("/əˈfem(ə)rəl/")
    expect(merged.example).toBe("local example")
    expect(merged.createdAt).toBe(1000)
  })
})

describe("isWordRecordChanged", () => {
  it("returns false when merge produced no effective change", () => {
    const local = makeWord()
    const merged = mergeWordRecords(local, makeWord({ id: "remote-id" }))
    expect(isWordRecordChanged(local, merged)).toBe(false)
  })

  it("returns true when review state advanced", () => {
    const local = makeWord()
    const merged = mergeWordRecords(local, makeWord({ id: "remote-id", reviewCount: 5, dueAt: 9999 }))
    expect(isWordRecordChanged(local, merged)).toBe(true)
  })
})
