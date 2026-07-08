import type { VocabularySaveWordPayload, VocabularyWord } from "@/types/vocabulary"
import type Vocabulary from "@/utils/db/dexie/tables/vocabulary"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { db } from "@/utils/db/dexie/db"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { isWordRecordChanged, mergeWordRecords } from "@/utils/vocabulary/merge"
import { initialSrsSchedule, nextSrsSchedule } from "@/utils/vocabulary/srs"
import { runGenerateTextInBackground } from "./llm-generate-text"

function toPlainWord(record: Vocabulary): VocabularyWord {
  return { ...record }
}

// 词表在后台变化后广播给扩展页面（如已打开的侧边栏），使列表即时刷新；无接收方时忽略
function notifyVocabularyWordsChanged() {
  void Promise.resolve(sendMessage("vocabularyWordsChanged", undefined)).catch(() => {})
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
  // 译文缺失时（异步入库场景），让 LLM 在补卡片内容的同时一并给出译文
  const needsTranslation = payload.translation.trim() === ""
  const savedPart = needsTranslation
    ? `The learner saved the word/phrase "${payload.word}" (no translation yet).`
    : `The learner saved the word/phrase "${payload.word}" with the translation "${payload.translation}".`
  const translationField = needsTranslation
    ? `"translation": "concise translation of the word into ${targetLangName}", `
    : ""

  return `You are a language learning assistant. ${savedPart}${contextPart}

Return a JSON object with exactly these string fields:
{${translationField}"phonetic": "IPA phonetic transcription of the word, or empty string if not applicable", "partOfSpeech": "part of speech such as noun/verb/adjective, or empty string", "example": "one short natural example sentence using the word, written in ${sourceLangName}", "exampleTranslation": "translation of that example sentence into ${targetLangName}"}

Return ONLY the JSON object, no markdown fences, no explanations.`
}

function parseEnrichResult(text: string): Partial<Pick<VocabularyWord, "translation" | "phonetic" | "partOfSpeech" | "example" | "exampleTranslation">> | null {
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
      translation: pickString("translation"),
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

// 补全进行中的词条 id，避免保存触发与打开生词本重试叠加造成重复请求
const enrichInFlightIds = new Set<string>()

async function enrichVocabularyWord(id: string, payload: VocabularySaveWordPayload, providerId: string) {
  if (enrichInFlightIds.has(id)) {
    return
  }
  enrichInFlightIds.add(id)
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
    const record = await db.vocabulary.get(id)
    if (!record) {
      return
    }
    // 只回填空字段，不覆盖已有内容（如保存时词典结果直接带上的音标/词性/译文）
    const changes: Partial<VocabularyWord> = {}
    for (const key of ["translation", "phonetic", "partOfSpeech", "example", "exampleTranslation"] as const) {
      if (!record[key] && enrichment[key]) {
        changes[key] = enrichment[key]
      }
    }
    if (Object.keys(changes).length === 0) {
      return
    }
    await db.vocabulary.update(id, changes)
    notifyVocabularyWordsChanged()
  }
  catch (error) {
    logger.error("[Background] vocabulary enrichment failed", { id, error })
  }
  finally {
    enrichInFlightIds.delete(id)
  }
}

/** 打开生词本时重试之前补全失败的词条（缺译文或缺卡片内容），一次最多重试几条 */
const MAX_PENDING_ENRICH_RETRIES = 5

function retryPendingEnrichments(records: Vocabulary[]) {
  const pending = records.filter(record =>
    record.enrichProviderId
    && !enrichInFlightIds.has(record.id)
    && (!record.translation || (!record.phonetic && !record.partOfSpeech && !record.example)),
  ).slice(0, MAX_PENDING_ENRICH_RETRIES)

  for (const record of pending) {
    void enrichVocabularyWord(record.id, {
      word: record.word,
      translation: record.translation,
      context: record.context,
      sourceUrl: record.sourceUrl,
      sourceLanguage: record.sourceLanguage,
      targetLanguage: record.targetLanguage,
    }, record.enrichProviderId!)
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
      phonetic: payload.phonetic,
      partOfSpeech: payload.partOfSpeech,
      enrichProviderId: payload.enrichProviderId,
      createdAt: now,
      dueAt: schedule.dueAt,
      intervalDays: schedule.intervalDays,
      reviewCount: 0,
    } as Vocabulary)

    if (payload.enrichProviderId) {
      void enrichVocabularyWord(id, { ...payload, word }, payload.enrichProviderId)
    }

    notifyVocabularyWordsChanged()
    return { id, existed: false }
  })

  onMessage("vocabularyListWords", async () => {
    const records = await db.vocabulary.orderBy("createdAt").reverse().toArray()
    // 顺带重试之前失败的异步补全，补全完成后会广播通知刷新列表
    retryPendingEnrichments(records)
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
    notifyVocabularyWordsChanged()
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
  if (!word) {
    return null
  }

  return {
    id: pickString("id") ?? crypto.randomUUID(),
    word,
    // 译文可能还在异步补全中（为空），不能因此丢掉整条记录
    translation: pickString("translation") ?? "",
    context: pickString("context"),
    sourceUrl: pickString("sourceUrl"),
    sourceLanguage: pickString("sourceLanguage"),
    targetLanguage: pickString("targetLanguage"),
    phonetic: pickString("phonetic"),
    partOfSpeech: pickString("partOfSpeech"),
    example: pickString("example"),
    exampleTranslation: pickString("exampleTranslation"),
    enrichProviderId: pickString("enrichProviderId"),
    createdAt: pickNumber("createdAt") ?? now,
    dueAt: pickNumber("dueAt") ?? now,
    intervalDays: pickNumber("intervalDays") ?? 0,
    reviewCount: pickNumber("reviewCount") ?? 0,
    lastReviewedAt: pickNumber("lastReviewedAt"),
    lastSeenAt: pickNumber("lastSeenAt"),
  } as Vocabulary
}
