import { Icon } from "@iconify/react"
import { browser, i18n } from "#imports"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"

const GITHUB_REPO_URL = "https://github.com/zhao-lei007/Immersive-Vocab"

export function MoreMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          />
        )}
      >
        <Icon icon="tabler:dots" className="size-4" strokeWidth={1.6} />
        <span className="text-[13px] font-medium">{i18n.t("popup.more.title")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-fit">
        <DropdownMenuItem
          onClick={() => window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer")}
          className="cursor-pointer"
        >
          <Icon icon="fa7-brands:github" className="size-4" strokeWidth={1.6} />
          {i18n.t("popup.more.starGithub")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/translation-hub.html") })}
          className="cursor-pointer"
        >
          <Icon icon="tabler:language-hiragana" className="size-4" strokeWidth={1.6} />
          {i18n.t("popup.more.translationHub")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open(`${GITHUB_REPO_URL}#readme`, "_blank", "noopener,noreferrer")}
          className="cursor-pointer"
        >
          <Icon icon="tabler:help-circle" className="size-4" strokeWidth={1.6} />
          {i18n.t("popup.more.tutorial")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
