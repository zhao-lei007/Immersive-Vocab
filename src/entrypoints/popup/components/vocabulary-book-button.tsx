import { Icon } from "@iconify/react"
import { browser, i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"

interface ChromiumSidePanelApi {
  open: (options: { windowId: number }) => Promise<void> | void
}

interface FirefoxSidebarActionApi {
  open?: () => Promise<void> | void
}

/** 生词本入口：打开承载生词本的浏览器侧边栏 */
export function VocabularyBookButton() {
  const handleClick = async () => {
    const sidePanel = (browser as typeof browser & { sidePanel?: ChromiumSidePanelApi }).sidePanel
    if (typeof sidePanel?.open === "function") {
      const currentWindow = await browser.windows.getCurrent()
      if (typeof currentWindow.id === "number") {
        await sidePanel.open({ windowId: currentWindow.id })
        window.close()
      }
      return
    }

    const sidebarAction = (browser as typeof browser & { sidebarAction?: FirefoxSidebarActionApi }).sidebarAction
    if (typeof sidebarAction?.open === "function") {
      await sidebarAction.open()
      window.close()
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => void handleClick()} />}>
        <Icon icon="tabler:book" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-wrap">
        {i18n.t("vocabulary.title")}
      </TooltipContent>
    </Tooltip>
  )
}
