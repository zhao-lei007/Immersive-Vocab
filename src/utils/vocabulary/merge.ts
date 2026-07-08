import type { VocabularyWord } from "@/types/vocabulary"

/** 判断哪条记录的复习进度更"新"：先比复习次数，再比最后复习时间 */
function hasNewerReviewState(a: VocabularyWord, b: VocabularyWord): boolean {
  if (a.reviewCount !== b.reviewCount) {
    return a.reviewCount > b.reviewCount
  }
  return (a.lastReviewedAt ?? 0) > (b.lastReviewedAt ?? 0)
}

function preferFilled(a: string | undefined, b: string | undefined): string | undefined {
  return a !== undefined && a !== "" ? a : b
}

/**
 * 合并同一个单词的本地/远端两条记录（跨设备同步用）：
 * 复习进度取更新的一方，卡片内容字段优先取非空值，创建时间取更早的。
 */
export function mergeWordRecords(local: VocabularyWord, incoming: VocabularyWord): VocabularyWord {
  const reviewSource = hasNewerReviewState(incoming, local) ? incoming : local

  return {
    ...local,
    translation: preferFilled(local.translation, incoming.translation) ?? local.translation,
    context: preferFilled(local.context, incoming.context),
    sourceUrl: preferFilled(local.sourceUrl, incoming.sourceUrl),
    sourceLanguage: preferFilled(local.sourceLanguage, incoming.sourceLanguage),
    targetLanguage: preferFilled(local.targetLanguage, incoming.targetLanguage),
    phonetic: preferFilled(local.phonetic, incoming.phonetic),
    partOfSpeech: preferFilled(local.partOfSpeech, incoming.partOfSpeech),
    example: preferFilled(local.example, incoming.example),
    exampleTranslation: preferFilled(local.exampleTranslation, incoming.exampleTranslation),
    createdAt: Math.min(local.createdAt, incoming.createdAt),
    dueAt: reviewSource.dueAt,
    intervalDays: reviewSource.intervalDays,
    reviewCount: reviewSource.reviewCount,
    lastReviewedAt: reviewSource.lastReviewedAt,
    lastSeenAt: Math.max(local.lastSeenAt ?? 0, incoming.lastSeenAt ?? 0) || undefined,
  }
}

/** 合并后与本地原记录相比是否有实际变化（避免无谓写库） */
export function isWordRecordChanged(before: VocabularyWord, after: VocabularyWord): boolean {
  const keys: (keyof VocabularyWord)[] = [
    "translation",
    "context",
    "sourceUrl",
    "sourceLanguage",
    "targetLanguage",
    "phonetic",
    "partOfSpeech",
    "example",
    "exampleTranslation",
    "createdAt",
    "dueAt",
    "intervalDays",
    "reviewCount",
    "lastReviewedAt",
    "lastSeenAt",
  ]
  return keys.some(key => before[key] !== after[key])
}
