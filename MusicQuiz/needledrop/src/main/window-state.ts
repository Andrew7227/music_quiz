import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface SavedState {
  bounds: Rectangle
  maximized: boolean
}

const DEFAULT: SavedState = { bounds: { x: 0, y: 0, width: 1280, height: 800 }, maximized: false }
const file = () => join(app.getPath('userData'), 'window-state.json')

function onScreen(b: Rectangle): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y < a.y + a.height - 80 && b.y + b.height > a.y
  })
}

/** Restores the last window size and position, if still on a connected display. */
export function loadWindowState(): { width: number; height: number; x?: number; y?: number; maximized: boolean } {
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as SavedState
    const { bounds } = saved
    if (bounds.width >= 400 && bounds.height >= 300 && onScreen(bounds)) {
      return { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y, maximized: !!saved.maximized }
    }
  } catch {
    // First launch or unreadable file: use defaults.
  }
  return { width: DEFAULT.bounds.width, height: DEFAULT.bounds.height, maximized: false }
}

export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined
  const save = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
    const state: SavedState = { bounds: win.isMaximized() ? (DEFAULT.bounds as Rectangle) : win.getBounds(), maximized: win.isMaximized() }
    if (win.isMaximized()) {
      try {
        const prev = JSON.parse(readFileSync(file(), 'utf8')) as SavedState
        state.bounds = prev.bounds
      } catch {
        // keep default bounds
      }
    }
    try {
      writeFileSync(file(), JSON.stringify(state))
    } catch {
      // Not critical.
    }
  }
  const debounced = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  }
  win.on('resize', debounced)
  win.on('move', debounced)
  win.on('maximize', save)
  win.on('unmaximize', save)
  win.on('close', save)
}
