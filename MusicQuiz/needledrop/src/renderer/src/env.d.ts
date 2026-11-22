/// <reference types="vite/client" />
import type { NeedledropApi } from '@shared/ipc'

declare global {
  interface Window {
    api: NeedledropApi
  }
}

export {}
