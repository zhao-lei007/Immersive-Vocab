import type { VocabularySaveWordPayload, VocabularyWord } from "@/types/vocabulary"
import type Vocabulary from "@/utils/db/dexie/tables/vocabulary"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { db } from "@/utils/db/dexie/db"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { isWordRecordChanged, mergeWordRecords } from "@/utils/vocabulary/merge"
import { initialSrsSchedule, nextSrsSchedule } from "@/utils/vocabulary/srs"
import { runGenerateTextInBackground } from "./llm-generate-text"

function toPlainWord(record: Vocabulary): VocabularyWord {
  return { ...record }
}

function toLanguageEnName(code: string | undefined): string | undefined {
  if (!code || code === "auto") {
    return undefined
  }
  return (LANG_CODE_TO_EN_NAME as Record<string, string>)[code]
}

function buildEnrichPrompt(payload: VocabularySaveWordPayload): string {
  const sourceLangName = toLanguageEnName(payload.sourceLanguage) ?? "the word's original language"
  const targetLangName = toLanguageEnName(payload.targetLanguage) ?? "the translation's language"
  const contextPart = payload.context ? `\nIt appeared in this context: "${payload.context}"` : ""

  return `You are a language learning assistant. The learner saved the word/phrase "${payload.word}" with the translation "${payload.translation}".${contextPart}

Return a JSON object with exactly these string fields:
{"phonetic": "IPA phonetic transcription of the word, or empty string if not applicable", "partOfSpeech": "part of speech such as noun/verb/adjective, or empty string", "example": "one short natural example sentence using the word, written in ${sourceLangName}", "exampleTranslation": "translation of that example sentence into ${targetLangName}"}

Return ONLY the JSON object, no markdown fences, no explanations.`
}

function parseEnrichResult(text: string): Partial<Pick<VocabularyWord, "phonetic" | "partOfSpeech" | "example" | "exampleTranslation">> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(jsonMatch[0])
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    const record = parsed as Record<string, unknown>
    const pickString = (key: string) => typeof record[key] === "string" && record[key].trim() !== "" ? record[key].trim() : undefined
    return {
      phonetic: pickString("phonetic"),
      partOfSpeech: pickString("partOfSpeech"),
      example: pickString("example"),
      exampleTranslation: pickString("exampleTranslation"),
    }
  }
  catch {
    return null
  }
}

async function enrichVocabularyWord(id: string, payload: VocabularySaveWordPayload, providerId: string) {
  try {
    const { text } = await runGenerateTextInBackground({
      providerId,
      prompt: buildEnrichPrompt(payload),
    })
    const enrichment = parseEnrichResult(text)
    if (!enrichment) {
      logger.warn("[Background] vocabulary enrichment returned unparseable result", { id, text })
      return
    }
    await db.vocabulary.update(id, enrichment)
  }
  catch (error) {
    logger.error("[Background] vocabulary enrichment failed", { id, error })
  }
}

export function setupVocabularyMessageHandlers() {
  onMessage("vocabularySaveWord", async (message) => {
    const payload = message.data
    const word = payload.word.trim()
    const existing = await db.vocabulary.where("word").equals(word).first()
    if (existing) {
      return { id: existing.id, existed: true }
    }

    const now = Date.now()
    const schedule = initialSrsSchedule(now)
    const id = crypto.randomUUID()
    await db.vocabulary.add({
      id,
      word,
      translation: payload.translation.trim(),
      context: payload.context,
      sourceUrl: payload.sourceUrl,
      sourceLanguage: payload.sourceLanguage,
      targetLanguage: payload.targetLanguage,
      createdAt: now,
      dueAt: schedule.dueAt,
      intervalDays: schedule.intervalDays,
      reviewCount: 0,
    } as Vocabulary)

    if (payload.enrichProviderId) {
      void enrichVocabularyWord(id, { ...payload, word }, payload.enrichProviderId)
    }

    return { id, existed: false }
  })

  onMessage("vocabularyListWords", async () => {
    const records = await db.vocabulary.orderBy("createdAt").reverse().toArray()
    return records.map(toPlainWord)
  })

  onMessage("vocabularyDueWords", async (message) => {
    const { limit, excludeWord } = message.data
    const now = Date.now()
    const records = await db.vocabulary
      .where("dueAt")
      .belowOrEqual(now)
      .sortBy("dueAt")
    return records
      .filter(record => excludeWord === undefined || record.word !== excludeWord)
      .slice(0, limit)
      .map(toPlainWord)
  })

  onMessage("vocabularyReviewWord", async (message) => {
    const { id, remembered } = message.data
    const record = await db.vocabulary.get(id)
    if (!record) {
      return null
    }

    const now = Date.now()
    const schedule = nextSrsSchedule(record.intervalDays, remembered, now)
    const changes = {
      dueAt: schedule.dueAt,
      intervalDays: schedule.intervalDays,
      reviewCount: record.reviewCount + 1,
      lastReviewedAt: now,
    }
    await db.vocabulary.update(id, changes)
    return { ...toPlainWord(record), ...changes }
  })

  onMessage("vocabularyDeleteWord", async (message) => {
    await db.vocabulary.delete(message.data.id)
  })

  onMessage("vocabularyHighlightWords", async () => {
    const records = await db.vocabulary.toArray()
    return records.map(({ id, word, translation }) => ({ id, word, translation }))
  })

  onMessage("vocabularyMarkWordSeen", async (message) => {
    await db.vocabulary.update(message.data.id, { lastSeenAt: Date.now() })
  })

  // 跨设备同步：远端记录与本地按单词合并（复习进度取更新的一方）
  onMessage("vocabularySyncMerge", async (message) => {
    const now = Date.now()
    const existingRecords = await db.vocabulary.toArray()
    const byWord = new Map(existingRecords.map(record => [record.word, record]))
    const existingIds = new Set(existingRecords.map(record => record.id))
    let added = 0
    let updated = 0

    for (const item of message.data.words) {
      const sanitized = sanitizeImportedWord(item, now)
      if (!sanitized) {
        continue
      }

      const local = byWord.get(sanitized.word)
      if (!local) {
        if (existingIds.has(sanitized.id)) {
          sanitized.id = crypto.randomUUID()
        }
        existingIds.add(sanitized.id)
        byWord.set(sanitized.word, sanitized)
        await db.vocabulary.add(sanitized)
        added++
        continue
      }

      const merged = mergeWordRecords(local, sanitized)
      if (isWordRecordChanged(local, merged)) {
        await db.vocabulary.put({ ...merged, id: local.id } as Vocabulary)
        updated++
      }
    }

    return { added, updated }
  })

  onMessage("vocabularyImportWords", async (message) => {
    const now = Date.now()
    const existingRecords = await db.vocabulary.toArray()
    const existingWords = new Set(existingRecords.map(record => record.word))
    const existingIds = new Set(existingRecords.map(record => record.id))
    const toImport: Vocabulary[] = []
    let skipped = 0

    for (const item of message.data.words) {
      const sanitized = sanitizeImportedWord(item, now)
      if (!sanitized || existingWords.has(sanitized.word)) {
        skipped++
        continue
      }
      if (existingIds.has(sanitized.id)) {
        sanitized.id = crypto.randomUUID()
      }
      existingWords.add(sanitized.word)
      existingIds.add(sanitized.id)
      toImport.push(sanitized)
    }

    if (toImport.length > 0) {
      await db.vocabulary.bulkAdd(toImport)
    }
    return { imported: toImport.length, skipped }
  })
}

function sanitizeImportedWord(item: unknown, now: number): Vocabulary | null {
  if (typeof item !== "object" || item === null) {
    return null
  }
  const record = item as Record<string, unknown>
  const pickString = (key: string) => typeof record[key] === "string" && record[key].trim() !== "" ? record[key].trim() : undefined
  const pickNumber = (key: string) => typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] : undefined

  const word = pickString("word")
  const translation = pickString("translation")
  if (!word || !translation) {
    return null
  }

  return {
    id: pickString("id") ?? crypto.randomUUID(),
    word,
    translation,
    context: pickString("context"),
    sourceUrl: pickString("sourceUrl"),
    sourceLanguage: pickString("sourceLanguage"),
    targetLanguage: pickString("targetLanguage"),
    phonetic: pickString("phonetic"),
    partOfSpeech: pickString("partOfSpeech"),
    example: pickString("example"),
    exampleTranslation: pickString("exampleTranslation"),
    createdAt: pickNumber("createdAt") ?? now,
    dueAt: pickNumber("dueAt") ?? now,
    intervalDays: pickNumber("intervalDays") ?? 0,
    reviewCount: pickNumber("reviewCount") ?? 0,
    lastReviewedAt: pickNumber("lastReviewedAt"),
    lastSeenAt: pickNumber("lastSeenAt"),
  } as Vocabulary
}
