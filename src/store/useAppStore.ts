import { create } from 'zustand'
import { startAlarmLoop, stopAlarmLoop } from '../audio/noise'
import { setMusicDuck } from '../lib/music'
import { db } from '../db'
import { uid } from '../lib/id'
import { todayKey } from '../lib/time'
import type {
  BackupPayload,
  DailyLog,
  Folder,
  Habit,
  Item,
  Lane,
  Note,
  Session,
  CompletionState,
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
  musicFolderLabel: '',
  musicFolderPath: '',
  alarmType: 'chime',
  alarmVolume: 0.4,
  musicPlayMode: 'sequence',
  liveTimer: null,
}

type State = {
  ready: boolean
  toast: string | null
  folders: Folder[]
  items: Item[]
  sessions: Session[]
  notes: Note[]
  dailyLogs: DailyLog[]
  habits: Habit[]
  settings: Settings
  timer: TimerState
  completion: CompletionState
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
  addHabit: (input: { title: string; content?: string; tags?: string[]; dailyMinMinutes?: number }) => Promise<string | null>
  updateHabit: (id: string, patch: Partial<Habit>) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  reorderHabits: (orderedIds: string[]) => Promise<void>
  startTimer: (itemId: string, minutes?: number, mode?: TimerMode) => Promise<void>
  pauseTimer: () => Promise<void>
  resumeTimer: () => void
  tickTimer: () => Promise<void>
  expireTimer: () => Promise<void>
  persistTimer: () => Promise<void>
  stopTimer: () => Promise<void>
  ackCompletion: () => void
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
    raw.slot === 'primary' || raw.slot === 'secondary' || raw.slot === 'other' || raw.slot === 'habit'
      ? raw.slot
      : 'other'
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
  const noiseType =
    raw?.noiseType === 'off' ||
    raw?.noiseType === 'white' ||
    raw?.noiseType === 'pink' ||
    raw?.noiseType === 'brown' ||
    raw?.noiseType === 'folder'
      ? raw.noiseType
      : DEFAULT_SETTINGS.noiseType
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    noiseType,
    musicFolderLabel: raw?.musicFolderLabel ?? DEFAULT_SETTINGS.musicFolderLabel,
    musicFolderPath: raw?.musicFolderPath ?? DEFAULT_SETTINGS.musicFolderPath,
    alarmType:
      raw?.alarmType === 'off' || raw?.alarmType === 'chime' || raw?.alarmType === 'bell' || raw?.alarmType === 'wood'
        ? raw.alarmType
        : DEFAULT_SETTINGS.alarmType,
    alarmVolume: typeof raw?.alarmVolume === 'number' ? raw.alarmVolume : DEFAULT_SETTINGS.alarmVolume,
    musicPlayMode:
      raw?.musicPlayMode === 'sequence' || raw?.musicPlayMode === 'loop' || raw?.musicPlayMode === 'shuffle'
        ? raw.musicPlayMode
        : DEFAULT_SETTINGS.musicPlayMode,
    liveTimer:
      raw?.liveTimer && typeof raw.liveTimer === 'object' && typeof raw.liveTimer.sessionId === 'string'
        ? raw.liveTimer
        : null,
    id: 'settings',
  }
}

async function persistLive(
  get: () => State,
  timer: Exclude<TimerState, null> | null,
) {
  const liveTimer = timer ? { ...timer, savedAt: Date.now() } : null
  const settings = mergeSettings({ ...get().settings, liveTimer })
  await db.settings.put(settings)
  if (!timer) return
  const session = get().sessions.find((s) => s.id === timer.sessionId)
  if (!session) return
  await db.sessions.put({ ...session, elapsedSeconds: Math.max(timer.elapsedSeconds, 0) })
}

function normalizeHabit(raw: Record<string, unknown>, index: number): Habit {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    content: typeof raw.content === 'string' ? raw.content : '',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((x) => typeof x === 'string') : [],
    dailyMinMinutes: Math.max(1, Number(raw.dailyMinMinutes ?? 15)),
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : index,
    archived: Boolean(raw.archived),
    totalSeconds: Number(raw.totalSeconds ?? 0),
    sessionCount: Number(raw.sessionCount ?? 0),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
  }
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
  habits: [],
  settings: DEFAULT_SETTINGS,
  timer: null,
  completion: null,

  setToast: (msg) => set({ toast: msg }),

  hydrate: async () => {
    const folders = await db.folders.toArray()
    let settings = mergeSettings(await db.settings.get('settings'))
    await db.settings.put(settings)
    const rawItems = (await db.items.toArray()) as unknown as Record<string, unknown>[]
    const items = rawItems.map((row, i) => normalizeItem(row, i))
    const rawSessions = (await db.sessions.toArray()) as unknown as Record<string, unknown>[]
    const sessions = rawSessions.map((row) => normalizeSession(row))
    const [notes, dailyLogs, rawHabits] = await Promise.all([
      db.notes.toArray(),
      db.dailyLogs.toArray(),
      db.habits.toArray(),
    ])
    const habits = (rawHabits as unknown as Record<string, unknown>[]).map((row, i) => normalizeHabit(row, i))
    const needsWrite = rawItems.some(
      (row) => !('content' in row) || !('sortOrder' in row) || !('reflux' in row),
    )
    if (needsWrite) await db.items.bulkPut(items)
    document.documentElement.lang = settings.locale === 'zh' ? 'zh-CN' : 'en'
    const saved = settings.liveTimer
    let timer = null as State['timer']
    if (saved) {
      const dt = saved.running ? Math.max(0, Math.floor((Date.now() - saved.savedAt) / 1000)) : 0
      const elapsedSeconds = saved.elapsedSeconds + dt
      const remainingSeconds =
        saved.mode === 'countdown' ? Math.max(0, saved.remainingSeconds - dt) : saved.remainingSeconds
      timer = {
        itemId: saved.itemId,
        sessionId: saved.sessionId,
        slot: saved.slot,
        mode: saved.mode,
        plannedSeconds: saved.plannedSeconds,
        elapsedSeconds,
        remainingSeconds,
        running: saved.running && !(saved.mode === 'countdown' && remainingSeconds <= 0),
      }
    }
    set({ ready: true, folders, items, sessions, notes, dailyLogs, habits, settings, timer })
    if (timer) await persistLive(get, timer)
    if (timer && timer.mode === 'countdown' && timer.remainingSeconds <= 0) {
      await get().expireTimer()
    }
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

  addHabit: async (input) => {
    const title = input.title.trim()
    if (!title) return null
    const now = Date.now()
    const maxOrder = get().habits.reduce((m, h) => Math.max(m, h.sortOrder), 0)
    const habit: Habit = {
      id: uid(),
      title,
      content: input.content?.trim() ?? '',
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      dailyMinMinutes: Math.max(1, input.dailyMinMinutes ?? 15),
      sortOrder: maxOrder + 1,
      archived: false,
      totalSeconds: 0,
      sessionCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    await db.habits.put(habit)
    set({ habits: [...get().habits, habit], toast: t(get().settings, 'habitAdded') })
    return habit.id
  },

  updateHabit: async (id, patch) => {
    const current = get().habits.find((h) => h.id === id)
    if (!current) return
    const next: Habit = { ...current, ...patch, updatedAt: Date.now() }
    await db.habits.put(next)
    set({ habits: get().habits.map((h) => (h.id === id ? next : h)) })
  },

  deleteHabit: async (id) => {
    await db.habits.delete(id)
    set({ habits: get().habits.filter((h) => h.id !== id), toast: t(get().settings, 'habitDeleted') })
  },

  reorderHabits: async (orderedIds) => {
    const now = Date.now()
    const next = get().habits.map((habit) => {
      const idx = orderedIds.indexOf(habit.id)
      if (idx < 0) return habit
      return { ...habit, sortOrder: idx, updatedAt: now }
    })
    await db.habits.bulkPut(next.filter((h) => orderedIds.includes(h.id)))
    set({ habits: next })
  },

  startTimer: async (itemId, minutes, mode) => {
    get().ackCompletion()
    if (get().timer) await get().stopTimer()
    const settings = get().settings
    const timerMode = mode ?? settings.timerMode
    const planned = timerMode === 'countdown' ? (minutes ?? settings.defaultMinutes) * 60 : 0
    const habit = get().habits.find((h) => h.id === itemId && !h.archived)
    const item = get().items.find((i) => i.id === itemId)
    if (!habit && !item) return
    const slot: Slot =
      habit ? 'habit' : item?.lane === 'primary' || item?.lane === 'secondary' ? item.lane : 'other'
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
    const timer = {
      itemId,
      sessionId: session.id,
      slot,
      mode: timerMode,
      plannedSeconds: planned,
      elapsedSeconds: 0,
      remainingSeconds: planned,
      running: true,
    }
    set({
      sessions: [session, ...get().sessions],
      timer,
    })
    await persistLive(get, timer)
  },

  pauseTimer: async () => {
    const timer = get().timer
    if (!timer) return
    const next = { ...timer, running: false }
    set({ timer: next })
    await persistLive(get, next)
  },

  resumeTimer: () => {
    const timer = get().timer
    if (!timer) return
    const next = { ...timer, running: true }
    set({ timer: next })
    void persistLive(get, next)
  },

  persistTimer: async () => {
    await persistLive(get, get().timer)
  },

  tickTimer: async () => {
    const timer = get().timer
    if (!timer?.running) return
    if (timer.mode === 'countup') {
      const next = { ...timer, elapsedSeconds: timer.elapsedSeconds + 1 }
      set({ timer: next })
      void persistLive(get, next)
      return
    }
    const remaining = timer.remainingSeconds - 1
    const elapsed = timer.elapsedSeconds + 1
    if (remaining <= 0) {
      await get().expireTimer()
      return
    }
    const next = { ...timer, remainingSeconds: remaining, elapsedSeconds: elapsed }
    set({ timer: next })
    void persistLive(get, next)
  },

  expireTimer: async () => {
    const timer = get().timer
    if (!timer || get().completion) return
    const habit = get().habits.find((h) => h.id === timer.itemId)
    const item = get().items.find((i) => i.id === timer.itemId)
    const title = habit?.title ?? item?.title ?? ''
    set({ completion: { itemId: timer.itemId, title } })
    await get().stopTimer()
    const settings = get().settings
    setMusicDuck(true)
    startAlarmLoop(settings.alarmType, settings.alarmVolume, 10000, () => get().ackCompletion())
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
    const habit = get().habits.find((h) => h.id === timer.itemId)
    if (habit && elapsed > 0) {
      await get().updateHabit(habit.id, {
        totalSeconds: habit.totalSeconds + elapsed,
        sessionCount: habit.sessionCount + 1,
      })
    } else {
      const item = get().items.find((i) => i.id === timer.itemId)
      if (item && elapsed > 0) {
        await get().updateItem(item.id, {
          totalSeconds: item.totalSeconds + elapsed,
          sessionCount: item.sessionCount + 1,
        })
      }
    }
    const settings = { ...get().settings, liveTimer: null }
    set({ timer: null, settings })
    await persistLive(get, null)
  },

  ackCompletion: () => {
    if (!get().completion) {
      stopAlarmLoop()
      setMusicDuck(false)
      return
    }
    stopAlarmLoop()
    setMusicDuck(false)
    set({ completion: null })
  },

  patchSettings: async (patch) => {
    const settings = mergeSettings({ ...get().settings, ...patch })
    await db.settings.put(settings)
    document.documentElement.lang = settings.locale === 'zh' ? 'zh-CN' : 'en'
    set({ settings })
  },

  exportBackup: async () => ({
    version: 3,
    exportedAt: Date.now(),
    folders: get().folders,
    items: get().items,
    sessions: get().sessions,
    notes: get().notes,
    dailyLogs: get().dailyLogs,
    habits: get().habits,
    settings: { ...get().settings, liveTimer: null },
  }),

  importBackup: async (payload) => {
    if (payload.version !== 1 && payload.version !== 2 && payload.version !== 3) throw new Error('unknown backup')
    const folderMap = new Map<string, string>()
    const itemMap = new Map<string, string>()
    const habitMap = new Map<string, string>()
    for (const folder of payload.folders ?? []) folderMap.set(folder.id, uid())
    for (const item of payload.items ?? []) itemMap.set(item.id, uid())
    for (const habit of payload.habits ?? []) habitMap.set(habit.id, uid())

    const folders = (payload.folders ?? []).map((folder) => ({
      ...folder,
      id: folderMap.get(folder.id)!,
      parentId: folder.parentId ? (folderMap.get(folder.parentId) ?? null) : null,
    }))

    let takePrimary = !slotItem(get().items, 'primary')
    let takeSecondary = !slotItem(get().items, 'secondary')
    let lotMax = get().items.filter((i) => i.lane === 'lot').reduce((m, i) => Math.max(m, i.sortOrder), 0)
    const items = (payload.items ?? []).map((item) => {
      let lane = item.lane
      if (lane === 'primary') {
        if (takePrimary) takePrimary = false
        else lane = 'lot'
      } else if (lane === 'secondary') {
        if (takeSecondary) takeSecondary = false
        else lane = 'lot'
      }
      const sortOrder = lane === 'lot' ? ++lotMax : item.sortOrder
      return {
        ...item,
        id: itemMap.get(item.id)!,
        folderId: item.folderId ? (folderMap.get(item.folderId) ?? null) : null,
        lane,
        sortOrder,
      }
    })

    let habitMax = get().habits.reduce((m, h) => Math.max(m, h.sortOrder), 0)
    const habits = (payload.habits ?? []).map((habit) => ({
      ...habit,
      id: habitMap.get(habit.id)!,
      sortOrder: ++habitMax,
    }))

    const sessions = (payload.sessions ?? []).map((session) => ({
      ...session,
      id: uid(),
      itemId: itemMap.get(session.itemId) ?? habitMap.get(session.itemId) ?? session.itemId,
    }))

    const notes = (payload.notes ?? []).map((note) => ({
      ...note,
      id: uid(),
      linkedItemId: note.linkedItemId
        ? (itemMap.get(note.linkedItemId) ?? habitMap.get(note.linkedItemId) ?? null)
        : null,
    }))

    const existingDates = new Set(get().dailyLogs.map((log) => log.date))
    const dailyLogs = (payload.dailyLogs ?? []).filter((log) => {
      if (existingDates.has(log.date)) return false
      existingDates.add(log.date)
      return true
    })

    await db.transaction(
      'rw',
      [db.folders, db.items, db.sessions, db.notes, db.dailyLogs, db.habits],
      async () => {
        if (folders.length) await db.folders.bulkAdd(folders)
        if (items.length) await db.items.bulkAdd(items)
        if (sessions.length) await db.sessions.bulkAdd(sessions)
        if (notes.length) await db.notes.bulkAdd(notes)
        if (dailyLogs.length) await db.dailyLogs.bulkAdd(dailyLogs)
        if (habits.length) await db.habits.bulkAdd(habits)
      },
    )
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

export function liveHabits(habits: Habit[]) {
  return habits.filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}
