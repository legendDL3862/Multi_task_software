import { shiftDay, todayKey } from './time'
import type { Habit, Session, Settings, Slot, TimerState } from '../types'

export type HabitDayRow = {
  id: string
  title: string
  seconds: number
  minSeconds: number
  met: boolean
}

export type DayStat = {
  date: string
  total: number
  primary: number
  secondary: number
  other: number
  habit: number
  habitSeconds: Record<string, number>
  habitRows: HabitDayRow[]
  primaryMet: boolean
  secondaryMet: boolean
  habitMet: boolean
  met: boolean
}

function dateOf(session: Session): string {
  return session.dateKey || todayKey(new Date(session.startedAt))
}

function slotOf(session: Pick<Session, 'slot'>): Slot {
  if (session.slot === 'primary' || session.slot === 'secondary' || session.slot === 'habit') return session.slot
  return 'other'
}

export function sessionsWithLive(sessions: Session[], timer: TimerState): Session[] {
  if (!timer || timer.elapsedSeconds <= 0) return sessions
  const live: Session = {
    id: timer.sessionId,
    itemId: timer.itemId,
    slot: timer.slot,
    dateKey: todayKey(),
    mode: timer.mode,
    plannedSeconds: timer.plannedSeconds,
    elapsedSeconds: timer.elapsedSeconds,
    startedAt: Date.now(),
    endedAt: null,
    captures: [],
  }
  return [...sessions.filter((s) => s.id !== timer.sessionId), live]
}

export function activeHabits(habits: Habit[]) {
  return habits.filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}

export function buildDayStats(sessions: Session[], settings: Settings, habits: Habit[] = []): Map<string, DayStat> {
  const map = new Map<string, DayStat>()
  function ensure(date: string): DayStat {
    const existing = map.get(date)
    if (existing) return existing
    const row: DayStat = {
      date,
      total: 0,
      primary: 0,
      secondary: 0,
      other: 0,
      habit: 0,
      habitSeconds: {},
      habitRows: [],
      primaryMet: false,
      secondaryMet: false,
      habitMet: true,
      met: false,
    }
    map.set(date, row)
    return row
  }
  for (const session of sessions) {
    if (session.elapsedSeconds <= 0) continue
    const row = ensure(dateOf(session))
    const slot = slotOf(session)
    row.total += session.elapsedSeconds
    if (slot === 'primary') row.primary += session.elapsedSeconds
    else if (slot === 'secondary') row.secondary += session.elapsedSeconds
    else if (slot === 'habit') {
      row.habit += session.elapsedSeconds
      row.habitSeconds[session.itemId] = (row.habitSeconds[session.itemId] ?? 0) + session.elapsedSeconds
    } else row.other += session.elapsedSeconds
  }
  const pMin = settings.primaryMinMinutes * 60
  const sMin = settings.secondaryMinMinutes * 60
  const liveHabits = activeHabits(habits)
  const dates = new Set([...map.keys(), todayKey()])
  for (const date of dates) ensure(date)
  for (const row of map.values()) {
    row.habitRows = liveHabits
      .filter((habit) => todayKey(new Date(habit.createdAt)) <= row.date)
      .map((habit) => {
        const seconds = row.habitSeconds[habit.id] ?? 0
        const minSeconds = Math.max(1, habit.dailyMinMinutes) * 60
        return {
          id: habit.id,
          title: habit.title,
          seconds,
          minSeconds,
          met: seconds >= minSeconds,
        }
      })
    row.primaryMet = row.primary >= pMin
    row.secondaryMet = row.secondary >= sMin
    row.habitMet = row.habitRows.every((h) => h.met)
    row.met = row.primaryMet && row.secondaryMet && row.habitMet
  }
  return map
}

export function lastNDays(n: number, end = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(end, i - (n - 1)))
}

export function sumRange(days: Map<string, DayStat>, keys: string[]) {
  return keys.reduce(
    (acc, key) => {
      const row = days.get(key)
      if (!row) return acc
      acc.total += row.total
      acc.primary += row.primary
      acc.secondary += row.secondary
      acc.other += row.other
      acc.habit += row.habit
      if (row.met) acc.metDays += 1
      return acc
    },
    { total: 0, primary: 0, secondary: 0, other: 0, habit: 0, metDays: 0 },
  )
}

export function monthKeys(year: number, month: number): string[] {
  const last = new Date(year, month, 0).getDate()
  return Array.from({ length: last }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    const m = String(month).padStart(2, '0')
    return `${year}-${m}-${d}`
  })
}

export function yearKeys(year: number): string[] {
  const start = `${year}-01-01`
  const end = todayKey()
  const keys: string[] = []
  let cursor = start
  while (cursor <= `${year}-12-31` && cursor <= end) {
    keys.push(cursor)
    cursor = shiftDay(cursor, 1)
  }
  return keys
}
