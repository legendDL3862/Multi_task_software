import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export type HudEvent = {
  type:
    | 'ack'
    | 'pauseTimer'
    | 'resumeTimer'
    | 'stopTimer'
    | 'play'
    | 'pause'
    | 'next'
    | 'prev'
    | 'timerDone'
}

type HudPlugin = {
  requestPermission: () => Promise<{ display: string }>
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
    media: { title: string; playing: boolean; artist: string; canSkip: boolean } | null
    complete: { title: string; body: string; confirmLabel: string } | null
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

export async function syncHud(_payload?: Parameters<HudPlugin['sync']>[0]) {
  await clearHud()
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
