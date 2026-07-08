import { browser } from "#imports"

export const APP_NAME = "Immersive Vocab"
const manifest = browser.runtime.getManifest()
export const EXTENSION_VERSION = manifest.version
