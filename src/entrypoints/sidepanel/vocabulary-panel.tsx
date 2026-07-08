import type { VocabularyWord } from "@/types/vocabulary"
import { IconBook2, IconCheck, IconDownload, IconExternalLink, IconTrash, IconUpload, IconVolume, IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Label } from "@/components/ui/base-ui/label"
import { Switch } from "@/components/ui/base-ui/switch"
import { onMessage, sendMessage } from "@/utils/message"
import {
  getVocabularyHighlightEnabled,
  setVocabularyHighlightEnabled,
} from "@/utils/vocabulary/highlight-storage"
import { SyncFolderSection } from "./sync-folder-section"

type PanelView = "review" | "list"

/** 导出文件格式版本，供将来兼容旧备份 */
const EXPORT_FORMAT_VERSION = 1

function exportWordsToFile(words: VocabularyWord[]) {
  const payload = {
    format: "read-frog-vocabulary",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    words,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `read-frog-vocabulary-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function parseImportFile(text: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(text)
    // 兼容两种格式：完整导出文件 { words: [...] } 或纯数组 [...]
    if (Array.isArray(parsed)) {
      return parsed
    }
    if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).words)) {
      return (parsed as { words: unknown[] }).words
    }
    return null
  }
  catch {
    return null
  }
}

function speakWord(text: string) {
  const utterance = new SpeechSynthesisUtterance(text)
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

function HighlightToggle() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    void getVocabularyHighlightEnabled().then(setEnabled)
  }, [])

  const handleChange = useCallback((next: boolean) => {
    setEnabled(next)
    void setVocabularyHighlightEnabled(next)
  }, [])

  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-sm font-normal">
        {i18n.t("vocabulary.highlightPageWords")}
      </Label>
      <Switch checked={enabled} onCheckedChange={handleChange} />
    </div>
  )
}

function FlashcardReview({
  dueWords,
  onReviewed,
}: {
  dueWords: VocabularyWord[]
  onReviewed: (updated: VocabularyWord) => void
}) {
  // 本地复习队列：忘了的词移到队尾再次出现
  const [queue, setQueue] = useState<VocabularyWord[]>(dueWords)
  const [revealed, setRevealed] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  const current = queue[0]

  const handleReview = useCallback(async (remembered: boolean) => {
    if (!current) {
      return
    }

    setRevealed(false)
    setQueue((prev) => {
      const [head, ...rest] = prev
      if (!head) {
        return prev
      }
      // 忘了的词稍后在本轮再复习一次
      return remembered ? rest : [...rest, head]
    })
    if (remembered) {
      setReviewedCount(prev => prev + 1)
    }

    try {
      const updated = await sendMessage("vocabularyReviewWord", { id: current.id, remembered })
      if (updated) {
        onReviewed(updated)
      }
    }
    catch {
      // 状态更新失败不阻塞复习流程
    }
  }, [current, onReviewed])

  if (!current) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-sm">
        <IconCheck className="size-8 text-green-500" />
        {reviewedCount > 0
          ? i18n.t("vocabulary.reviewDone")
          : i18n.t("vocabulary.noDueWords")}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-muted-foreground mb-3 text-xs">
        {i18n.t("vocabulary.dueCount", [queue.length])}
      </p>
      <div className="bg-card flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border p-6 text-center">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold break-words [overflow-wrap:anywhere]">
            {current.word}
          </span>
          <Button
            type="button"
            variant="ghost-secondary"
            size="icon-xs"
            aria-label={i18n.t("action.speak")}
            onClick={() => speakWord(current.word)}
          >
            <IconVolume />
          </Button>
        </div>
        {revealed
          ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {current.translation}
                  {current.phonetic ? ` ${current.phonetic}` : ""}
                  {current.partOfSpeech ? ` · ${current.partOfSpeech}` : ""}
                </p>
                {current.example && (
                  <p className="text-muted-foreground break-words [overflow-wrap:anywhere]">
                    {current.example}
                    {current.exampleTranslation ? <br /> : null}
                    {current.exampleTranslation}
                  </p>
                )}
                {current.context && !current.example && (
                  <p className="text-muted-foreground break-words [overflow-wrap:anywhere]">
                    {current.context}
                  </p>
                )}
              </div>
            )
          : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRevealed(true)}
              >
                {i18n.t("vocabulary.showAnswer")}
              </Button>
            )}
      </div>
      {revealed && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => void handleReview(false)}
          >
            <IconX className="size-4 text-red-500" />
            {i18n.t("vocabulary.forgot")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => void handleReview(true)}
          >
            <IconCheck className="size-4 text-green-500" />
            {i18n.t("vocabulary.remembered")}
          </Button>
        </div>
      )}
    </div>
  )
}

function WordList({
  words,
  onDelete,
}: {
  words: VocabularyWord[]
  onDelete: (id: string) => void
}) {
  if (words.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-sm">
        <IconBook2 className="size-8" />
        {i18n.t("vocabulary.noWords")}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {words.map(word => (
        <div key={word.id} className="bg-card rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium break-words [overflow-wrap:anywhere]">
                {word.word}
                {word.phonetic ? <span className="text-muted-foreground ml-1 font-normal">{word.phonetic}</span> : null}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm break-words [overflow-wrap:anywhere]">
                {word.partOfSpeech ? `${word.partOfSpeech} · ` : ""}
                {/* 译文由后台异步补全，还没到时先展示占位符 */}
                {word.translation || "…"}
              </p>
              {word.example && (
                <p className="text-muted-foreground mt-1 text-xs break-words [overflow-wrap:anywhere]">
                  {word.example}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center">
              {word.sourceUrl && (
                <Button
                  type="button"
                  variant="ghost-secondary"
                  size="icon-xs"
                  aria-label={i18n.t("vocabulary.openSource")}
                  onClick={() => void sendMessage("openPage", { url: word.sourceUrl!, active: true })}
                >
                  <IconExternalLink />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost-secondary"
                size="icon-xs"
                aria-label={i18n.t("vocabulary.deleteWord")}
                onClick={() => onDelete(word.id)}
              >
                <IconTrash />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function VocabularyPanel() {
  const [view, setView] = useState<PanelView>("review")
  const [words, setWords] = useState<VocabularyWord[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        setWords(await sendMessage("vocabularyListWords"))
      }
      finally {
        setIsLoaded(true)
      }
    })()
  }, [])

  // 页面上保存/复习生词后，后台会广播变更通知，这里重新拉取列表
  useEffect(() => {
    return onMessage("vocabularyWordsChanged", async () => {
      setWords(await sendMessage("vocabularyListWords"))
    })
  }, [])

  const handleImportFile = useCallback(async (file: File) => {
    const importedWords = parseImportFile(await file.text())
    if (!importedWords) {
      toast.error(i18n.t("vocabulary.importInvalidFile"))
      return
    }

    try {
      const result = await sendMessage("vocabularyImportWords", { words: importedWords })
      setWords(await sendMessage("vocabularyListWords"))
      toast.success(i18n.t("vocabulary.importSuccess", [result.imported, result.skipped]))
    }
    catch (error) {
      toast.error(i18n.t("vocabulary.importFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [])

  const dueWords = useMemo(() => {
    const now = Date.now()
    return words.filter(word => word.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt)
  }, [words])

  const handleReviewed = useCallback((updated: VocabularyWord) => {
    setWords(prev => prev.map(word => word.id === updated.id ? updated : word))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setWords(prev => prev.filter(word => word.id !== id))
    void sendMessage("vocabularyDeleteWord", { id })
  }, [])

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col gap-4 px-4 py-5">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            {i18n.t("vocabulary.title")}
          </h1>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground mr-1 text-xs">
              {i18n.t("vocabulary.totalCount", [words.length])}
            </span>
            <Button
              type="button"
              variant="ghost-secondary"
              size="icon-xs"
              aria-label={i18n.t("vocabulary.export")}
              title={i18n.t("vocabulary.export")}
              disabled={words.length === 0}
              onClick={() => exportWordsToFile(words)}
            >
              <IconDownload />
            </Button>
            <Button
              type="button"
              variant="ghost-secondary"
              size="icon-xs"
              aria-label={i18n.t("vocabulary.import")}
              title={i18n.t("vocabulary.import")}
              onClick={() => importInputRef.current?.click()}
            >
              <IconUpload />
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                // 允许连续选择同一个文件
                event.target.value = ""
                if (file) {
                  void handleImportFile(file)
                }
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={view === "review" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setView("review")}
          >
            {i18n.t("vocabulary.review")}
            {dueWords.length > 0 ? ` (${dueWords.length})` : ""}
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setView("list")}
          >
            {i18n.t("vocabulary.allWords")}
          </Button>
        </div>
        <HighlightToggle />
        <SyncFolderSection onSynced={setWords} />
      </header>
      {isLoaded && (
        view === "review"
          ? (
              // 组件挂载时用当下的到期词初始化本轮队列，复习过程中不重建
              <FlashcardReview
                dueWords={dueWords}
                onReviewed={handleReviewed}
              />
            )
          : <WordList words={words} onDelete={handleDelete} />
      )}
    </main>
  )
}
