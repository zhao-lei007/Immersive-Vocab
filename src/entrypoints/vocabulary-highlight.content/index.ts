import type { VocabularyHighlightWord } from "@/types/vocabulary"
import { defineContentScript } from "#imports"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import {
  getVocabularyHighlightEnabled,
  watchVocabularyHighlightEnabled,
} from "@/utils/vocabulary/highlight-storage"

const HIGHLIGHT_CLASS = "read-frog-vocab-highlight"
const TOOLTIP_ID = "read-frog-vocab-tooltip"
/** 参与高亮的生词数量上限，避免超大生词本拖慢页面 */
const MAX_WORDS = 500
/** 单页高亮数量上限 */
const MAX_HIGHLIGHTS = 1000
const MUTATION_DEBOUNCE_MS = 500

const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "IFRAME", "CANVAS", "SVG", "CODE", "PRE"])

interface HighlightState {
  wordsById: Map<string, VocabularyHighlightWord>
  regex: RegExp
  /** word 文本（小写）→ id，用于命中后反查 */
  idByLowerWord: Map<string, string>
  highlightCount: number
  seenWordIds: Set<string>
  observer: MutationObserver | null
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function containsCJK(text: string): boolean {
  // 日文假名、CJK 统一表意文字、谚文音节
  return /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(text)
}

function buildHighlightRegex(words: VocabularyHighlightWord[]): RegExp | null {
  const alternatives = words
    .map((word) => {
      const escaped = escapeRegExp(word.word)
      // 拉丁语系单词加词边界，避免命中子串；CJK 词直接子串匹配
      return containsCJK(word.word)
        ? escaped
        : `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`
    })
  if (alternatives.length === 0) {
    return null
  }
  return new RegExp(alternatives.join("|"), "giu")
}

function shouldSkipElement(element: Element): boolean {
  if (SKIPPED_TAGS.has(element.tagName)) {
    return true
  }
  if (element.classList.contains(HIGHLIGHT_CLASS) || element.id === TOOLTIP_ID) {
    return true
  }
  if ((element as HTMLElement).isContentEditable) {
    return true
  }
  return false
}

function highlightTextNode(textNode: Text, state: HighlightState) {
  const text = textNode.data
  if (!text || text.trim().length < 2) {
    return
  }

  state.regex.lastIndex = 0
  let match = state.regex.exec(text)
  if (!match) {
    return
  }

  const fragment = document.createDocumentFragment()
  let lastIndex = 0
  while (match && state.highlightCount < MAX_HIGHLIGHTS) {
    const matchedText = match[0]
    const wordId = state.idByLowerWord.get(matchedText.toLowerCase())
    if (wordId) {
      if (match.index > lastIndex) {
        fragment.append(text.slice(lastIndex, match.index))
      }
      const span = document.createElement("span")
      span.className = HIGHLIGHT_CLASS
      span.dataset.readFrogVocabId = wordId
      span.textContent = matchedText
      fragment.append(span)
      lastIndex = match.index + matchedText.length
      state.highlightCount++
    }
    // 防止空匹配死循环
    if (state.regex.lastIndex === match.index) {
      state.regex.lastIndex++
    }
    match = state.regex.exec(text)
  }

  if (lastIndex === 0) {
    return
  }
  if (lastIndex < text.length) {
    fragment.append(text.slice(lastIndex))
  }
  textNode.replaceWith(fragment)
}

function walkAndHighlight(root: Node, state: HighlightState) {
  if (state.highlightCount >= MAX_HIGHLIGHTS) {
    return
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || shouldSkipElement(parent) || parent.closest(`.${HIGHLIGHT_CLASS}`)) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }
  for (const textNode of textNodes) {
    if (state.highlightCount >= MAX_HIGHLIGHTS) {
      break
    }
    highlightTextNode(textNode, state)
  }
}

function injectStyle(): HTMLStyleElement {
  const style = document.createElement("style")
  style.textContent = `
.${HIGHLIGHT_CLASS} {
  background: rgba(251, 191, 36, 0.22);
  border-bottom: 1px dashed rgba(217, 119, 6, 0.9);
  border-radius: 2px;
  cursor: help;
}
#${TOOLTIP_ID} {
  position: fixed;
  z-index: 2147483647;
  max-width: 280px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #262626;
  color: #fafafa;
  font-size: 13px;
  line-height: 1.5;
  pointer-events: none;
  display: none;
  word-break: break-word;
}
`
  document.head.append(style)
  return style
}

function createTooltip(): HTMLDivElement {
  const tooltip = document.createElement("div")
  tooltip.id = TOOLTIP_ID
  document.documentElement.append(tooltip)
  return tooltip
}

function removeAllHighlights() {
  const spans = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)
  for (const span of spans) {
    const parent = span.parentNode
    span.replaceWith(document.createTextNode(span.textContent ?? ""))
    parent?.normalize()
  }
}

export default defineContentScript({
  matches: ["*://*/*"],
  async main(ctx) {
    let state: HighlightState | null = null
    let styleElement: HTMLStyleElement | null = null
    let tooltipElement: HTMLDivElement | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    const showTooltip = (target: HTMLElement, word: VocabularyHighlightWord) => {
      if (!tooltipElement) {
        tooltipElement = createTooltip()
      }
      tooltipElement.textContent = word.translation
      tooltipElement.style.display = "block"
      const rect = target.getBoundingClientRect()
      const tooltipRect = tooltipElement.getBoundingClientRect()
      const top = rect.top - tooltipRect.height - 6
      tooltipElement.style.top = `${top >= 0 ? top : rect.bottom + 6}px`
      tooltipElement.style.left = `${Math.min(Math.max(rect.left, 4), window.innerWidth - tooltipRect.width - 4)}px`
    }

    const hideTooltip = () => {
      if (tooltipElement) {
        tooltipElement.style.display = "none"
      }
    }

    const handleMouseOver = (event: MouseEvent) => {
      const currentState = state
      if (!currentState) {
        return
      }
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.classList.contains(HIGHLIGHT_CLASS)) {
        return
      }
      const wordId = target.dataset.readFrogVocabId
      const word = wordId ? currentState.wordsById.get(wordId) : undefined
      if (!word) {
        return
      }
      showTooltip(target, word)
      // 每个词每个页面只记录一次"看到过"
      if (!currentState.seenWordIds.has(word.id)) {
        currentState.seenWordIds.add(word.id)
        void sendMessage("vocabularyMarkWordSeen", { id: word.id }).catch(() => {})
      }
    }

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && target.classList.contains(HIGHLIGHT_CLASS)) {
        hideTooltip()
      }
    }

    const disable = () => {
      state?.observer?.disconnect()
      state = null
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      hideTooltip()
      removeAllHighlights()
      document.removeEventListener("mouseover", handleMouseOver)
      document.removeEventListener("mouseout", handleMouseOut)
    }

    const enable = async () => {
      if (state) {
        return
      }

      let words: VocabularyHighlightWord[]
      try {
        words = await sendMessage("vocabularyHighlightWords")
      }
      catch (error) {
        logger.warn("[VocabularyHighlight] failed to load words", error)
        return
      }

      const usableWords = words
        .filter(word => word.word.trim().length >= 2)
        .sort((a, b) => b.word.length - a.word.length)
        .slice(0, MAX_WORDS)
      const regex = buildHighlightRegex(usableWords)
      if (!regex) {
        return
      }

      if (!styleElement) {
        styleElement = injectStyle()
      }

      const nextState: HighlightState = {
        wordsById: new Map(usableWords.map(word => [word.id, word])),
        idByLowerWord: new Map(usableWords.map(word => [word.word.toLowerCase(), word.id])),
        regex,
        highlightCount: 0,
        seenWordIds: new Set(),
        observer: null,
      }
      state = nextState

      walkAndHighlight(document.body, nextState)

      document.addEventListener("mouseover", handleMouseOver)
      document.addEventListener("mouseout", handleMouseOut)

      // 动态内容（SPA、无限滚动）：防抖后增量高亮新增节点
      const observer = new MutationObserver((mutations) => {
        if (state !== nextState || nextState.highlightCount >= MAX_HIGHLIGHTS) {
          return
        }
        const addedRoots = new Set<Node>()
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              addedRoots.add(node)
            }
          }
        }
        if (addedRoots.size === 0) {
          return
        }
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        debounceTimer = setTimeout(() => {
          if (state !== nextState) {
            return
          }
          for (const root of addedRoots) {
            if (!root.isConnected) {
              continue
            }
            walkAndHighlight(root, nextState)
          }
        }, MUTATION_DEBOUNCE_MS)
      })
      observer.observe(document.body, { childList: true, subtree: true })
      nextState.observer = observer
    }

    const enabled = await getVocabularyHighlightEnabled()
    if (enabled) {
      void enable()
    }

    const unwatch = watchVocabularyHighlightEnabled((nextEnabled) => {
      if (nextEnabled) {
        void enable()
      }
      else {
        disable()
      }
    })

    ctx.onInvalidated(() => {
      unwatch()
      disable()
    })
  },
})
