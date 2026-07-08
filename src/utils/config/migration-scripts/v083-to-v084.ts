/**
 * Migration script from v083 to v084
 * - This fork removes the hosted "Free AI Service" (read-frog-free-ai).
 *   Custom actions that pointed at it are reassigned to the default
 *   OpenAI-compatible provider so the config stays valid.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

/** 在用户已有 provider 里找一个可用的 LLM provider（有 model 字段且启用） */
function findFallbackLLMProviderId(providersConfig: any): string {
  if (Array.isArray(providersConfig)) {
    const candidate = providersConfig.find(provider =>
      provider
      && typeof provider === "object"
      && provider.enabled === true
      && provider.model !== undefined
      && typeof provider.id === "string",
    )
    if (candidate) {
      return candidate.id
    }
  }
  return "openai-default"
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  if (!selectionToolbar || typeof selectionToolbar !== "object" || !Array.isArray(selectionToolbar.customActions)) {
    return oldConfig
  }

  const fallbackProviderId = findFallbackLLMProviderId(oldConfig.providersConfig)

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      customActions: selectionToolbar.customActions.map((action: any) => {
        if (!action || typeof action !== "object" || action.providerId !== "read-frog-free-ai") {
          return action
        }
        return { ...action, providerId: fallbackProviderId }
      }),
    },
  }
}
