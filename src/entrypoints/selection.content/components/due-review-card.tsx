import type { VocabularyWord } from "@/types/vocabulary"
import { IconCheck, IconX } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { sendMessage } from "@/utils/message"

const MAX_DUE_WORDS = 2

type ReviewPhase = "hidden" | "revealed" | "done"

function DueReviewItem({ word }: { word: VocabularyWord }) {
  const [phase, setPhase] = useState<ReviewPhase>("hidden")

  const handleReview = (remembered: boolean) => {
    setPhase("done")
    void sendMessage("vocabularyReviewWord", { id: word.id, remembered })
  }

  return (
    <div className="flex min-h-7 items-center gap-2 text-sm">
      <span className="font-medium break-words [overflow-wrap:anywhere]">{word.word}</span>
      {phase === "hidden" && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="ml-auto shrink-0"
          onClick={() => setPhase("revealed")}
        >
          {i18n.t("vocabulary.showAnswer")}
        </Button>
      )}
      {phase === "revealed" && (
        <>
          <span className="text-muted-foreground break-words [overflow-wrap:anywhere]">
            {word.translation}
            {word.phonetic ? ` ${word.phonetic}` : ""}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => handleReview(true)}
            >
              <IconCheck className="size-3.5 text-green-500" />
              {i18n.t("vocabulary.remembered")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => handleReview(false)}
            >
              <IconX className="size-3.5 text-red-500" />
              {i18n.t("vocabulary.forgot")}
            </Button>
          </div>
        </>
      )}
      {phase === "done" && (
        <span className="text-muted-foreground ml-auto shrink-0">
          <IconCheck className="size-4 text-green-500" />
        </span>
      )}
    </div>
  )
}

/**
 * 翻译弹窗底部的到期生词复习卡：翻译完成后展示 1~2 个到期生词，
 * 让复习自然融入每次翻译的场景。
 */
export function DueReviewCard({ active, excludeWord }: { active: boolean, excludeWord?: string }) {
  const [dueWords, setDueWords] = useState<VocabularyWord[]>([])
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (!active || hasFetchedRef.current) {
      return
    }
    hasFetchedRef.current = true

    let cancelled = false
    void (async () => {
      try {
        const words = await sendMessage("vocabularyDueWords", { limit: MAX_DUE_WORDS, excludeWord })
        if (!cancelled) {
          setDueWords(words)
        }
      }
      catch {
        // 复习卡是附加功能，拉取失败时静默跳过
      }
    })()

    return () => {
      cancelled = true
    }
  }, [active, excludeWord])

  if (dueWords.length === 0) {
    return null
  }

  return (
    <div className="border-t px-4 py-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium">
        {i18n.t("vocabulary.reviewPromptTitle")}
      </p>
      <div className="space-y-1.5">
        {dueWords.map(word => (
          <DueReviewItem key={word.id} word={word} />
        ))}
      </div>
    </div>
  )
}
