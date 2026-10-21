import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export type HudEvent = {
  type:
    | 'ack'
    | 'pauseTimer'
    | 'resumeTimer'
    | 'stopTimer'
    | 'timerDone'
    | 'musicPlay'
    | 'musicPause'
    | 'musicPrev'
    | 'musicNext'
    | 'musicBack'
    | 'musicFwd'
    | 'musicMode'
}

export type HudSnapshot = {
  running: boolean
  elapsed: number
  remaining: number
  mode?: string
  title?: string
}

type HudPlugin = {
  requestPermission: () => Promise<{ display: string }>
  snapshot: () => Promise<HudSnapshot | undefined>
  sync: (payload: {
    timer: {
      title: string
      mode: 'countdown' | 'countup'
      remaining: number
      elapsed: number
      running: boolean
      pauseLabel: string
      resumeLabel: string
      stopLabel: string
    } | null
    media: null
    complete: { title: string; body: string } | null
  }) => Promise<void>
  syncMedia: (payload: {
    active: boolean
    title: string
    artist: string
    playing: boolean
    folder: boolean
    current: number
    duration: number
    playLabel: string
    pauseLabel: string
    prevLabel: string
    nextLabel: string
    backLabel: string
    fwdLabel: string
    modeLabel: string
  }) => Promise<void>
  clear: () => Promise<void>
  addListener: (event: 'hud', cb: (event: HudEvent) => void) => Promise<PluginListenerHandle>
}

const Hud = registerPlugin<HudPlugin>('Hud')

export function hudAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function requestHudPermission() {
  if (!hudAvailable()) return
  try {
    await Hud.requestPermission()
  } catch {
    /* ignore */
  }
}

export async function readHudSnapshot(): Promise<HudSnapshot | null> {
  if (!hudAvailable()) return null
  try {
    const snap = await Hud.snapshot()
    if (!snap || typeof snap.elapsed !== 'number') return null
    return snap
  } catch {
    return null
  }
}

export async function syncHud(payload: Parameters<HudPlugin['sync']>[0]) {
  if (!hudAvailable()) return
  try {
    if (!payload.timer && !payload.complete) {
      await Hud.clear()
      return
    }
    await Hud.sync(payload)
  } catch {
    /* ignore */
  }
}

export async function syncMusicHud(payload: Parameters<HudPlugin['syncMedia']>[0]) {
  if (!hudAvailable()) return
  try {
    await Hud.syncMedia(payload)
  } catch {
    /* ignore */
  }
}

export async function clearHud() {
  if (!hudAvailable()) return
  try {
    await Hud.clear()
  } catch {
    /* ignore */
  }
}

export function listenHud(cb: (event: HudEvent) => void) {
  if (!hudAvailable()) return () => undefined
  let handle: PluginListenerHandle | undefined
  void Hud.addListener('hud', cb).then((h) => {
    handle = h
  })
  return () => {
    void handle?.remove()
  }
}
