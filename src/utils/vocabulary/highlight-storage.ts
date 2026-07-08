import { storage } from "#imports"

// 页面生词高亮开关，独立于主配置存储，避免引入配置迁移
const HIGHLIGHT_ENABLED_KEY = "local:vocabularyHighlightEnabled"

export async function getVocabularyHighlightEnabled(): Promise<boolean> {
  return (await storage.getItem<boolean>(HIGHLIGHT_ENABLED_KEY)) ?? false
}

export async function setVocabularyHighlightEnabled(enabled: boolean): Promise<void> {
  await storage.setItem(HIGHLIGHT_ENABLED_KEY, enabled)
}

export function watchVocabularyHighlightEnabled(
  callback: (enabled: boolean) => void,
): () => void {
  return storage.watch<boolean>(HIGHLIGHT_ENABLED_KEY, (enabled) => {
    callback(enabled ?? false)
  })
}
