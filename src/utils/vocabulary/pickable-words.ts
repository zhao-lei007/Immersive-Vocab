/** 从划选的原文中提取可单独收藏的候选生词（拉丁字母类语言按词切分） */

const WORD_PATTERN = /\p{L}[\p{L}'’-]*/gu
const CJK_PATTERN = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/u
const MAX_PICKABLE_WORDS = 40

export function extractPickableWords(text: string | null | undefined): string[] {
  if (!text) {
    return []
  }

  const seen = new Set<string>()
  const words: string[] = []
  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0]
    // CJK 无空格分词不可靠，跳过含 CJK 的 token；过滤单字母 token
    if (word.length < 2 || CJK_PATTERN.test(word)) {
      continue
    }
    const key = word.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    words.push(word)
    if (words.length >= MAX_PICKABLE_WORDS) {
      break
    }
  }
  return words
}
