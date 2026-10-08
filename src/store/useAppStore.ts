import { create } from 'zustand'
import { playChime } from '../audio/noise'
import { db } from '../db'
import { uid } from '../lib/id'
import { todayKey } from '../lib/time'
import type {
  BackupPayload,
  DailyLog,
  Folder,
  Item,
  Lane,
  Note,
  Session,
  Settings,
  Slot,
  TimerMode,
  TimerState,
} from '../types'
import { strings } from '../i18n'

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  noiseType: 'white',
  noiseVolume: 0.18,
  defaultMinutes: 25,
  locale: 'zh',
  scene: 'dusk',
  timerMode: 'countdown',
  primaryMinMinutes: 90,
  secondaryMinMinutes: 30,
}

type State = {
  ready: boolean
  toast: string | null
  folders: Folder[]
  items: Item[]
  sessions: Session[]
  notes: Note[]
  dailyLogs: DailyLog[]
  settings: Settings
  timer: TimerState
  hydrate: () => Promise<void>
  setToast: (msg: string | null) => void
  addItem: (input: { title: string; content?: string; tags?: string[]; reflux?: boolean }) => Promise<string | null>
  updateItem: (id: string, patch: Partial<Item>) => Promise<void>
  promote: (id: string, slot: 'primary' | 'secondary') => Promise<void>
  park: (id: string) => Promise<void>
  complete: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  reorderQueue: (orderedIds: string[]) => Promise<void>
  applyTopOrder: (ids: string[]) => Promise<void>
  startTimer: (itemId: string, minutes?: number, mode?: TimerMode) => Promise<void>
  pauseTimer: () => Promise<void>
  resumeTimer: () => void
  tickTimer: () => Promise<void>
  stopTimer: () => Promise<void>
  patchSettings: (patch: Partial<Settings>) => Promise<void>
  exportBackup: () => Promise<BackupPayload>
  importBackup: (payload: BackupPayload) => Promise<void>
}

function t(settings: Settings, key: keyof typeof strings.zh) {
  return strings[settings.locale][key]
}

function normalizeItem(raw: Record<string, unknown>, index: number): Item {
  const note = typeof raw.note === 'string' ? raw.note : ''
  const content = typeof raw.content === 'string' ? raw.content : note
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((x) => typeof x === 'string') : []
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    content,
    tags,
    lane: (raw.lane as Lane) ?? 'lot',
    folderId: (raw.folderId as string | null) ?? null,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : index,
    reflux: raw.reflux !== false,
    buried: Boolean(raw.buried),
    totalSeconds: Number(raw.totalSeconds ?? 0),
    sessionCount: Number(raw.sessionCount ?? 0),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
    completedAt: (raw.completedAt as number | null) ?? null,
  }
}

function normalizeSession(raw: Record<string, unknown>): Session {
  const itemId = String(raw.itemId)
  const slot: Slot =
    raw.slot === 'primary' || raw.slot === 'secondary' || raw.slot === 'other' ? raw.slot : 'other'
  const startedAt = Number(raw.startedAt ?? Date.now())
  return {
    id: String(raw.id),
    itemId,
    slot,
    dateKey: typeof raw.dateKey === 'string' ? raw.dateKey : todayKey(new Date(startedAt)),
    mode: raw.mode === 'countup' ? 'countup' : 'countdown',
    plannedSeconds: Number(raw.plannedSeconds ?? 0),
    elapsedSeconds: Number(raw.elapsedSeconds ?? 0),
    startedAt,
    endedAt: (raw.endedAt as number | null) ?? null,
    captures: Array.isArray(raw.captures) ? raw.captures.filter((x) => typeof x === 'string') : [],
  }
}

function mergeSettings(raw: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...raw, id: 'settings' }
}

async function putItem(item: Item) {
  await db.items.put(item)
}

export const useAppStore = create<State>((set, get) => ({
  ready: false,
  toast: null,
  folders: [],
  items: [],
  sessions: [],
  notes: [],
  dailyLogs: [],
  settings: DEFAULT_SETTINGS,
  timer: null,

  setToast: (msg) => set({ toast: msg }),

  hydrate: async () => {
    const folders = await db.folders.toArray()
    let settings = mergeSettings(await db.settings.get('settings'))
    await db.settings.put(settings)
    const rawItems = (await db.items.toArray()) as unknown as Record<string, unknown>[]
    const items = rawItems.map((row, i) => normalizeItem(row, i))
    const rawSessions = (await db.sessions.toArray()) as unknown as Record<string, unknown>[]
    const sessions = rawSessions.map((row) => normalizeSession(row))
    const [notes, dailyLogs] = await Promise.all([db.notes.toArray(), db.dailyLogs.toArray()])
    const needsWrite = rawItems.some(
      (row) => !('content' in row) || !('sortOrder' in row) || !('reflux' in row),
    )
    if (needsWrite) await db.items.bulkPut(items)
    document.documentElement.lang = settings.locale === 'zh' ? 'zh-CN' : 'en'
    set({ ready: true, folders, items, sessions, notes, dailyLogs, settings })
  },

  addItem: async (input) => {
    const title = input.title.trim()
    if (!title) return null
    const now = Date.now()
    const lot = get().items.filter((i) => i.lane === 'lot')
    const maxOrder = lot.reduce((m, i) => Math.max(m, i.sortOrder), 0)
    const item: Item = {
      id: uid(),
      title,
      content: input.content?.trim() ?? '',
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      lane: 'lot',
      folderId: null,
      sortOrder: maxOrder + 1,
      reflux: input.reflux !== false,
      buried: false,
      totalSeconds: 0,
      sessionCount: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }
    await putItem(item)
    const timer = get().timer
    if (timer) {
      const session = get().sessions.find((s) => s.id === timer.sessionId)
      if (session) {
        const next = { ...session, captures: [...session.captures, title] }
        await db.sessions.put(next)
        set({ sessions: get().sessions.map((s) => (s.id === next.id ? next : s)) })
      }
    }
    set({ items: [item, ...get().items], toast: t(get().settings, 'parkedToast') })
    return item.id
  },

  updateItem: async (id, patch) => {
    const current = get().items.find((i) => i.id === id)
    if (!current) return
    const next: Item = { ...current, ...patch, updatedAt: Date.now() }
    await putItem(next)
    set({ items: get().items.map((i) => (i.id === id ? next : i)) })
  },

  promote: async (id, slot) => {
    const items = get().items
    const occupant = items.find((i) => i.lane === slot && i.id !== id)
    const now = Date.now()
    const nextItems = items.map((i) => {
      if (i.id === id) return { ...i, lane: slot as Lane, updatedAt: now }
      if (occupant && i.id === occupant.id) return { ...i, lane: 'lot' as Lane, updatedAt: now }
      return i
    })
    await db.items.bulkPut(nextItems.filter((i) => i.updatedAt === now))
    set({ items: nextItems })
  },

  park: async (id) => {
    await get().updateItem(id, { lane: 'lot' })
  },

  complete: async (id) => {
    const timer = get().timer
    if (timer?.itemId === id) await get().stopTimer()
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    if (item.reflux) {
      await get().updateItem(id, { lane: 'archive', completedAt: Date.now(), buried: false })
      set({ toast: t(get().settings, 'refluxToast') })
      return
    }
    await get().deleteItem(id)
    set({ toast: t(get().settings, 'doneToast') })
  },

  restore: async (id) => {
    await get().updateItem(id, { lane: 'lot', completedAt: null, buried: false })
    set({ toast: t(get().settings, 'restoreToast') })
  },

  deleteItem: async (id) => {
    if (get().timer?.itemId === id) await get().stopTimer()
    await db.items.delete(id)
    set({
      items: get().items.filter((i) => i.id !== id),
      toast: t(get().settings, 'deletedToast'),
    })
  },

  reorderQueue: async (orderedIds) => {
    const now = Date.now()
    const next = get().items.map((item) => {
      const idx = orderedIds.indexOf(item.id)
      if (idx < 0) return item
      return { ...item, sortOrder: idx, updatedAt: now }
    })
    await db.items.bulkPut(next.filter((i) => orderedIds.includes(i.id)))
    set({ items: next })
  },

  applyTopOrder: async (ids) => {
    const now = Date.now()
    const next = get().items.map((item) => {
      const idx = ids.indexOf(item.id)
      if (idx < 0) return item
      const lane: Lane = idx === 0 ? 'primary' : idx === 1 ? 'secondary' : 'lot'
      return { ...item, lane, sortOrder: idx, updatedAt: now }
    })
    await db.items.bulkPut(next.filter((i) => ids.includes(i.id)))
    set({ items: next })
  },

  startTimer: async (itemId, minutes, mode) => {
    if (get().timer) await get().stopTimer()
    const settings = get().settings
    const timerMode = mode ?? settings.timerMode
    const planned = timerMode === 'countdown' ? (minutes ?? settings.defaultMinutes) * 60 : 0
    const item = get().items.find((i) => i.id === itemId)
    const slot: Slot = item?.lane === 'primary' || item?.lane === 'secondary' ? item.lane : 'other'
    const session: Session = {
      id: uid(),
      itemId,
      slot,
      dateKey: todayKey(),
      mode: timerMode,
      plannedSeconds: planned,
      elapsedSeconds: 0,
      startedAt: Date.now(),
      endedAt: null,
      captures: [],
    }
    await db.sessions.put(session)
    set({
      sessions: [session, ...get().sessions],
      timer: {
        itemId,
        sessionId: session.id,
        slot,
        mode: timerMode,
        plannedSeconds: planned,
        elapsedSeconds: 0,
        remainingSeconds: planned,
        running: true,
      },
    })
  },

  pauseTimer: async () => {
    const timer = get().timer
    if (!timer) return
    set({ timer: { ...timer, running: false } })
  },

  resumeTimer: () => {
    const timer = get().timer
    if (!timer) return
    set({ timer: { ...timer, running: true } })
  },

  tickTimer: async () => {
    const timer = get().timer
    if (!timer?.running) return
    if (timer.mode === 'countup') {
      set({ timer: { ...timer, elapsedSeconds: timer.elapsedSeconds + 1 } })
      return
    }
    const remaining = timer.remainingSeconds - 1
    const elapsed = timer.elapsedSeconds + 1
    if (remaining <= 0) {
      set({ timer: { ...timer, remainingSeconds: 0, elapsedSeconds: elapsed, running: false } })
      playChime()
      await get().stopTimer()
      return
    }
    set({ timer: { ...timer, remainingSeconds: remaining, elapsedSeconds: elapsed } })
  },

  stopTimer: async () => {
    const timer = get().timer
    if (!timer) return
    const elapsed = timer.elapsedSeconds
    const session = get().sessions.find((s) => s.id === timer.sessionId)
    if (session) {
      const nextSession = { ...session, elapsedSeconds: Math.max(elapsed, 0), endedAt: Date.now() }
      await db.sessions.put(nextSession)
      set({ sessions: get().sessions.map((s) => (s.id === nextSession.id ? nextSession : s)) })
    }
    const item = get().items.find((i) => i.id === timer.itemId)
    if (item && elapsed > 0) {
      await get().updateItem(item.id, {
        totalSeconds: item.totalSeconds + elapsed,
        sessionCount: item.sessionCount + 1,
      })
    }
    set({ timer: null })
  },

  patchSettings: async (patch) => {
    const settings = mergeSettings({ ...get().settings, ...patch })
    await db.settings.put(settings)
    document.documentElement.lang = settings.locale === 'zh' ? 'zh-CN' : 'en'
    set({ settings })
  },

  exportBackup: async () => ({
    version: 2,
    exportedAt: Date.now(),
    folders: get().folders,
    items: get().items,
    sessions: get().sessions,
    notes: get().notes,
    dailyLogs: get().dailyLogs,
    settings: get().settings,
  }),

  importBackup: async (payload) => {
    if (payload.version !== 1 && payload.version !== 2) throw new Error('unknown backup')
    await db.transaction('rw', [db.folders, db.items, db.sessions, db.notes, db.dailyLogs, db.settings], async () => {
      await Promise.all([
        db.folders.clear(),
        db.items.clear(),
        db.sessions.clear(),
        db.notes.clear(),
        db.dailyLogs.clear(),
      ])
      if (payload.folders.length) await db.folders.bulkAdd(payload.folders)
      if (payload.items.length) await db.items.bulkAdd(payload.items)
      if (payload.sessions.length) await db.sessions.bulkAdd(payload.sessions)
      if (payload.notes.length) await db.notes.bulkAdd(payload.notes)
      if (payload.dailyLogs.length) await db.dailyLogs.bulkAdd(payload.dailyLogs)
      await db.settings.put(mergeSettings(payload.settings))
    })
    await get().hydrate()
  },
}))

export function queueItems(items: Item[]) {
  return items
    .filter((i) => i.lane === 'lot' && !i.buried)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}

export function slotItem(items: Item[], slot: 'primary' | 'secondary') {
  return items.find((i) => i.lane === slot)
}
