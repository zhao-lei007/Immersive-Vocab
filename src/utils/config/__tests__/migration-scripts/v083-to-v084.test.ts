import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v083-to-v084"

describe("v083-to-v084 migration", () => {
  it("reassigns free AI custom actions to the first enabled LLM provider in the config", () => {
    const migrated = migrate({
      providersConfig: [
        { id: "microsoft-translate-default", provider: "microsoft-translate", enabled: true },
        { id: "deepseek-default", provider: "deepseek", enabled: true, model: { model: "deepseek-chat" } },
      ],
      selectionToolbar: {
        customActions: [
          { id: "action-a", providerId: "read-frog-free-ai" },
          { id: "action-b", providerId: "deepseek-default" },
        ],
      },
    })

    expect(migrated.selectionToolbar.customActions[0]).toEqual({
      id: "action-a",
      providerId: "deepseek-default",
    })
    expect(migrated.selectionToolbar.customActions[1]).toEqual({
      id: "action-b",
      providerId: "deepseek-default",
    })
  })

  it("skips disabled LLM providers and falls back to openai-default when none is available", () => {
    const migrated = migrate({
      providersConfig: [
        { id: "microsoft-translate-default", provider: "microsoft-translate", enabled: true },
        { id: "openai-custom", provider: "openai", enabled: false, model: { model: "gpt-5.2" } },
      ],
      selectionToolbar: {
        customActions: [
          { id: "action-a", providerId: "read-frog-free-ai" },
        ],
      },
    })

    expect(migrated.selectionToolbar.customActions[0]).toEqual({
      id: "action-a",
      providerId: "openai-default",
    })
  })

  it("leaves configs without free AI actions unchanged", () => {
    const oldConfig = {
      providersConfig: [
        { id: "openai-default", provider: "openai", enabled: true, model: { model: "gpt-5.2" } },
      ],
      selectionToolbar: {
        customActions: [
          { id: "action-a", providerId: "openai-default" },
        ],
      },
    }

    const migrated = migrate(oldConfig)

    expect(migrated.selectionToolbar.customActions[0]).toEqual(oldConfig.selectionToolbar.customActions[0])
  })
})
