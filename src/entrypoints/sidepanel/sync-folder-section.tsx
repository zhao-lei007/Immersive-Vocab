import type { VocabularyWord } from "@/types/vocabulary"
import { IconCloud, IconFolderPlus, IconRefresh, IconUnlink } from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { sendMessage } from "@/utils/message"
import {
  chooseSyncDirectory,
  clearSyncDirectory,
  getLastSyncedAt,
  getSavedSyncDirectory,
  isFileSyncSupported,
  querySyncPermission,
  requestSyncPermission,
  runVocabularySync,
} from "@/utils/vocabulary/file-sync"

type SyncStatus = "unconfigured" | "needs-permission" | "ready" | "syncing"

/**
 * 生词本文件夹同步：选一次 iCloud Drive/网盘目录，
 * 之后打开侧边栏自动双向同步，由用户自己的同步盘负责跨设备传输。
 */
export function SyncFolderSection({ onSynced }: { onSynced: (words: VocabularyWord[]) => void }) {
  const [status, setStatus] = useState<SyncStatus>("unconfigured")
  const [folderName, setFolderName] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const hasAutoSyncedRef = useRef(false)

  const refreshWords = useCallback(async () => {
    onSynced(await sendMessage("vocabularyListWords"))
  }, [onSynced])

  const doSync = useCallback(async (handle: NonNullable<Awaited<ReturnType<typeof getSavedSyncDirectory>>>, options?: { silent?: boolean }) => {
    setStatus("syncing")
    try {
      const result = await runVocabularySync(handle)
      setLastSyncedAt(result.syncedAt)
      setStatus("ready")
      if (result.added > 0 || result.updated > 0) {
        await refreshWords()
      }
      if (!options?.silent || result.added > 0 || result.updated > 0) {
        toast.success(i18n.t("vocabulary.syncSuccess", [result.added, result.updated]))
      }
    }
    catch (error) {
      setStatus("ready")
      toast.error(i18n.t("vocabulary.syncFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [refreshWords])

  // 挂载时恢复句柄；有权限则自动同步一次
  useEffect(() => {
    if (!isFileSyncSupported()) {
      return
    }

    void (async () => {
      const handle = await getSavedSyncDirectory()
      if (!handle) {
        return
      }
      setFolderName(handle.name)
      setLastSyncedAt(await getLastSyncedAt())

      const permission = await querySyncPermission(handle)
      if (permission === "granted") {
        setStatus("ready")
        if (!hasAutoSyncedRef.current) {
          hasAutoSyncedRef.current = true
          await doSync(handle, { silent: true })
        }
      }
      else {
        setStatus("needs-permission")
      }
    })()
  }, [doSync])

  if (!isFileSyncSupported()) {
    return null
  }

  const handleChoose = async () => {
    try {
      const handle = await chooseSyncDirectory()
      setFolderName(handle.name)
      setStatus("ready")
      await doSync(handle)
    }
    catch {
      // 用户取消选择
    }
  }

  const handleGrant = async () => {
    const handle = await getSavedSyncDirectory()
    if (!handle) {
      setStatus("unconfigured")
      return
    }
    const permission = await requestSyncPermission(handle)
    if (permission === "granted") {
      setStatus("ready")
      await doSync(handle)
    }
  }

  const handleSyncNow = async () => {
    const handle = await getSavedSyncDirectory()
    if (handle) {
      await doSync(handle)
    }
  }

  const handleDisconnect = async () => {
    await clearSyncDirectory()
    setFolderName(null)
    setLastSyncedAt(null)
    setStatus("unconfigured")
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <IconCloud className="text-muted-foreground size-4 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm">
            {status === "unconfigured"
              ? i18n.t("vocabulary.syncFolderTitle")
              : folderName}
          </p>
          {status !== "unconfigured" && lastSyncedAt && (
            <p className="text-muted-foreground text-xs">
              {i18n.t("vocabulary.syncLastAt", [new Date(lastSyncedAt).toLocaleString()])}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {status === "unconfigured" && (
          <Button type="button" variant="outline" size="xs" onClick={() => void handleChoose()}>
            <IconFolderPlus className="size-3.5" />
            {i18n.t("vocabulary.chooseSyncFolder")}
          </Button>
        )}
        {status === "needs-permission" && (
          <Button type="button" variant="outline" size="xs" onClick={() => void handleGrant()}>
            {i18n.t("vocabulary.syncGrant")}
          </Button>
        )}
        {(status === "ready" || status === "syncing") && (
          <>
            <Button
              type="button"
              variant="ghost-secondary"
              size="icon-xs"
              aria-label={i18n.t("vocabulary.syncNow")}
              title={i18n.t("vocabulary.syncNow")}
              disabled={status === "syncing"}
              onClick={() => void handleSyncNow()}
            >
              <IconRefresh className={status === "syncing" ? "animate-spin" : undefined} />
            </Button>
            <Button
              type="button"
              variant="ghost-secondary"
              size="icon-xs"
              aria-label={i18n.t("vocabulary.syncDisconnect")}
              title={i18n.t("vocabulary.syncDisconnect")}
              onClick={() => void handleDisconnect()}
            >
              <IconUnlink />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
