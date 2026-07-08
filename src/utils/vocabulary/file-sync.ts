import type { VocabularyWord } from "@/types/vocabulary"
import { storage } from "#imports"
import { sendMessage } from "@/utils/message"

// 生词本文件同步：把生词本读写到用户选定的本地文件夹（iCloud Drive/网盘均可），
// 由用户自己的同步盘负责跨设备传输。仅在扩展页面上下文可用（File System Access API）。

const SYNC_FILE_NAME = "immersive-vocab.json"
const SYNC_FORMAT = "immersive-vocab-sync"
const HANDLE_DB_NAME = "ImmersiveVocabSyncHandle"
const HANDLE_STORE = "handles"
const HANDLE_KEY = "syncDirectory"
const LAST_SYNCED_AT_KEY = "local:vocabularySyncLastSyncedAt"

type PermissionState = "granted" | "denied" | "prompt"

interface DirectoryHandleLike {
  readonly name: string
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
    getFile: () => Promise<File>
    createWritable: () => Promise<{ write: (data: string) => Promise<void>, close: () => Promise<void> }>
  }>
}

export function isFileSyncSupported(): boolean {
  return typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function"
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withHandleStore<T>(
  mode: IDBTransactionMode,
  operate: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const dbInstance = await openHandleDB()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operate(dbInstance.transaction(HANDLE_STORE, mode).objectStore(HANDLE_STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  finally {
    dbInstance.close()
  }
}

export async function getSavedSyncDirectory(): Promise<DirectoryHandleLike | null> {
  const handle = await withHandleStore("readonly", store => store.get(HANDLE_KEY)) as DirectoryHandleLike | undefined
  return handle ?? null
}

export async function chooseSyncDirectory(): Promise<DirectoryHandleLike> {
  const picker = (globalThis as unknown as {
    showDirectoryPicker: (options: { mode: "readwrite" }) => Promise<DirectoryHandleLike>
  }).showDirectoryPicker
  const handle = await picker({ mode: "readwrite" })
  await withHandleStore("readwrite", store => store.put(handle, HANDLE_KEY))
  return handle
}

export async function clearSyncDirectory(): Promise<void> {
  await withHandleStore("readwrite", store => store.delete(HANDLE_KEY))
  await storage.removeItem(LAST_SYNCED_AT_KEY)
}

export async function querySyncPermission(handle: DirectoryHandleLike): Promise<PermissionState> {
  return (await handle.queryPermission?.({ mode: "readwrite" })) ?? "prompt"
}

/** 需要用户手势触发（按钮点击） */
export async function requestSyncPermission(handle: DirectoryHandleLike): Promise<PermissionState> {
  return (await handle.requestPermission?.({ mode: "readwrite" })) ?? "denied"
}

export async function getLastSyncedAt(): Promise<number | null> {
  return await storage.getItem<number>(LAST_SYNCED_AT_KEY)
}

// iCloud Drive 等同步盘的文件可能正在下载或被占用，读写会瞬时失败，稍等重试即可恢复
const TRANSIENT_RETRY_ATTEMPTS = 3
const TRANSIENT_RETRY_DELAY_MS = 500

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError"
}

async function withTransientRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation()
    }
    catch (error) {
      if (isFileNotFoundError(error)) {
        throw error
      }
      lastError = error
      if (attempt < TRANSIENT_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS * attempt))
      }
    }
  }
  throw lastError
}

async function readRemoteWords(handle: DirectoryHandleLike): Promise<unknown[] | null> {
  let file: File
  try {
    file = await withTransientRetry(async () => {
      const fileHandle = await handle.getFileHandle(SYNC_FILE_NAME)
      return await fileHandle.getFile()
    })
  }
  catch (error) {
    // 只有文件不存在才视为首次同步；其他读取失败要抛出，避免误把本地数据覆盖远端文件
    if (isFileNotFoundError(error)) {
      return null
    }
    throw error
  }

  try {
    const parsed: unknown = JSON.parse(await file.text())
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

async function writeRemoteWords(handle: DirectoryHandleLike, words: VocabularyWord[]): Promise<void> {
  await withTransientRetry(async () => {
    const fileHandle = await handle.getFileHandle(SYNC_FILE_NAME, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(JSON.stringify({
      format: SYNC_FORMAT,
      version: 1,
      updatedAt: new Date().toISOString(),
      words,
    }, null, 2))
    await writable.close()
  })
}

export interface SyncResult {
  added: number
  updated: number
  total: number
  syncedAt: number
}

/** 双向同步：拉取远端文件合并进本地，再把合并后的全量写回文件 */
export async function runVocabularySync(handle: DirectoryHandleLike): Promise<SyncResult> {
  const remoteWords = await readRemoteWords(handle)

  let added = 0
  let updated = 0
  if (remoteWords && remoteWords.length > 0) {
    const mergeResult = await sendMessage("vocabularySyncMerge", { words: remoteWords })
    added = mergeResult.added
    updated = mergeResult.updated
  }

  const allWords = await sendMessage("vocabularyListWords")
  await writeRemoteWords(handle, allWords)

  const syncedAt = Date.now()
  await storage.setItem(LAST_SYNCED_AT_KEY, syncedAt)
  return { added, updated, total: allWords.length, syncedAt }
}
