import type { VocabularySaveWordPayload } from "@/types/vocabulary"
import { IconCheck, IconLoader2, IconPlus } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { extractPickableWords } from "@/utils/vocabulary/pickable-words"

type PickState = "saving" | "saved"

interface SourceWordPickerProps {
  /** 划选的原文（同时作为生词的上下文句子） */
  sourceText: string | null | undefined
  active: boolean
  /** 复用整句保存的 payload 里的语言/URL/enrich 配置 */
  basePayload: VocabularySaveWordPayload | null
  /** 用当前 Provider 翻译单个词 */
  onTranslateWord: (word: string) => Promise<string>
}

/**
 * 从原文挑生词：划选的往往是整句，真正要背的是句中的某个词。
 * 翻译完成后把原文按词展示成可点选的 chips，点击即单独收藏该词。
 */
export function SourceWordPicker({
  sourceText,
  active,
  basePayload,
  onTranslateWord,
}: SourceWordPickerProps) {
  const [pickStates, setPickStates] = useState<Record<string, PickState>>({})

  const words = useMemo(() => extractPickableWords(sourceText), [sourceText])

  // 单个词的场景由整句书签按钮覆盖，这里只处理多词句子
  if (!active || !basePayload || words.length < 2) {
    return null
  }

  const handlePick = async (word: string) => {
    const key = word.toLowerCase()
    if (pickStates[key]) {
      return
    }

    setPickStates(prev => ({ ...prev, [key]: "saving" }))
    try {
      const translation = await onTranslateWord(word)
      const result = await sendMessage("vocabularySaveWord", {
        word,
        translation,
        context: basePayload.word,
        sourceUrl: basePayload.sourceUrl,
        sourceLanguage: basePayload.sourceLanguage,
        targetLanguage: basePayload.targetLanguage,
        enrichProviderId: basePayload.enrichProviderId,
      })
      setPickStates(prev => ({ ...prev, [key]: "saved" }))
      toast.success(result.existed
        ? i18n.t("vocabulary.alreadyInVocabulary")
        : i18n.t("vocabulary.addedToVocabulary"), {
        description: translation ? `${word} · ${translation}` : word,
      })
    }
    catch (error) {
      setPickStates((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      toast.error(i18n.t("vocabulary.addFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="border-t px-4 py-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium">
        {i18n.t("vocabulary.pickFromSource")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word) => {
          const state = pickStates[word.toLowerCase()]
          return (
            <button
              key={word}
              type="button"
              disabled={state !== undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition-colors",
                state === "saved"
                  ? "border-transparent bg-muted text-muted-foreground"
                  : "hover:bg-muted cursor-pointer",
              )}
              onClick={() => void handlePick(word)}
            >
              {word}
              {state === "saving" && <IconLoader2 className="size-3 animate-spin" />}
              {state === "saved" && <IconCheck className="size-3 text-green-500" />}
              {state === undefined && <IconPlus className="text-muted-foreground size-3" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
