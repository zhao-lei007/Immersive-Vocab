import type { VocabularySaveWordPayload } from "@/types/vocabulary"
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { SelectionPopoverTooltip, useSelectionTooltipState } from "./selection-tooltip"

export function SaveWordButton({ payload }: { payload: VocabularySaveWordPayload | null }) {
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { handlePress, onOpenChange: handleTooltipOpenChange, open: tooltipOpen } = useSelectionTooltipState()

  const handleSave = useCallback(async () => {
    if (!payload || saved || isSaving) {
      return
    }

    setIsSaving(true)
    handlePress()
    try {
      const result = await sendMessage("vocabularySaveWord", payload)
      setSaved(true)
      toast.success(result.existed
        ? i18n.t("vocabulary.alreadyInVocabulary")
        : i18n.t("vocabulary.addedToVocabulary"))
    }
    catch (error) {
      toast.error(i18n.t("vocabulary.addFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
    finally {
      setIsSaving(false)
    }
  }, [handlePress, isSaving, payload, saved])

  return (
    <SelectionPopoverTooltip
      content={saved ? i18n.t("vocabulary.added") : i18n.t("vocabulary.addToVocabulary")}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={(
        <button
          type="button"
          disabled={!payload || isSaving}
          className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-sm" }))}
          onClick={() => void handleSave()}
        />
      )}
    >
      {saved
        ? <IconBookmarkFilled className="text-amber-500" />
        : <IconBookmark />}
    </SelectionPopoverTooltip>
  )
}
