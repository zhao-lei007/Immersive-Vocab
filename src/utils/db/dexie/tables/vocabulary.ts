import { Entity } from "dexie"

export default class Vocabulary extends Entity {
  id!: string
  word!: string
  translation!: string
  context?: string
  sourceUrl?: string
  sourceLanguage?: string
  targetLanguage?: string
  phonetic?: string
  partOfSpeech?: string
  example?: string
  exampleTranslation?: string
  enrichProviderId?: string
  createdAt!: number
  dueAt!: number
  intervalDays!: number
  reviewCount!: number
  lastReviewedAt?: number
  lastSeenAt?: number
}
