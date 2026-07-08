/**
 * Migration script from v084 to v085
 * - 悬浮按钮主按钮改为生词本入口：点击动作从"翻译开关"改为"打开侧边栏"。
 *   翻译开关仍可通过悬浮按钮展开后的翻译子按钮使用。
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  const floatingButton = oldConfig.floatingButton
  if (!floatingButton || typeof floatingButton !== "object") {
    return oldConfig
  }

  return {
    ...oldConfig,
    floatingButton: {
      ...floatingButton,
      clickAction: "panel",
    },
  }
}
