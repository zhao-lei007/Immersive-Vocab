// 生词本相关类型
export interface VocabularyWord {
  id: string
  word: string
  translation: string
  /** 划词时的上下文句子/段落 */
  context?: string
  /** 来源页面 URL */
  sourceUrl?: string
  sourceLanguage?: string
  targetLanguage?: string
  // LLM 补充的卡片内容
  phonetic?: string
  partOfSpeech?: string
  example?: string
  exampleTranslation?: string
  // 简化间隔重复调度
  createdAt: number
  /** 到期复习时间戳，<= now 表示待复习 */
  dueAt: number
  /** 当前间隔天数，0 表示新词/刚忘记 */
  intervalDays: number
  reviewCount: number
  lastReviewedAt?: number
  /** 页面高亮场景最近一次看到的时间 */
  lastSeenAt?: number
}

export interface VocabularySaveWordPayload {
  word: string
  translation: string
  context?: string
  sourceUrl?: string
  sourceLanguage?: string
  targetLanguage?: string
  /** 用于异步补充卡片内容（音标/词性/例句）的 LLM provider */
  enrichProviderId?: string
}

export interface VocabularySaveWordResult {
  id: string
  /** 该词已存在时为 true（不会重复添加） */
  existed: boolean
}

/** 页面高亮所需的最小字段 */
export interface VocabularyHighlightWord {
  id: string
  word: string
  translation: string
}
