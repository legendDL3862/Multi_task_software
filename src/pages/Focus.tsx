import { useEffect, useMemo, useState } from 'react'
import { playAlarm } from '../audio/noise'
import { TimerRing } from '../components/TimerRing'
import { useI18n } from '../hooks/useI18n'
import { buildDayStats, sessionsWithLive } from '../lib/stats'
import { formatDuration, todayKey } from '../lib/time'
import { liveHabits, queueItems, slotItem, useAppStore } from '../store/useAppStore'
import type { AlarmType, Scene } from '../types'

const SCENES: Scene[] = ['dusk', 'paper', 'forest', 'night', 'sand']
const ALARMS: AlarmType[] = ['off', 'chime', 'bell', 'wood']

export function FocusPage() {
  const t = useI18n()
  const items = useAppStore((s) => s.items)
  const habitRecords = useAppStore((s) => s.habits)
  const habits = liveHabits(habitRecords)
  const sessions = useAppStore((s) => s.sessions)
  const timer = useAppStore((s) => s.timer)
  const settings = useAppStore((s) => s.settings)
  const startTimer = useAppStore((s) => s.startTimer)
  const pauseTimer = useAppStore((s) => s.pauseTimer)
  const resumeTimer = useAppStore((s) => s.resumeTimer)
  const stopTimer = useAppStore((s) => s.stopTimer)
  const completion = useAppStore((s) => s.completion)
  const ackCompletion = useAppStore((s) => s.ackCompletion)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const primary = slotItem(items, 'primary')
  const secondary = slotItem(items, 'secondary')
  const others = queueItems(items)
  const [taskId, setTaskId] = useState('')
  const [minutes, setMinutes] = useState<number | ''>(settings.defaultMinutes)

  const taskItem = items.find((i) => i.id === taskId && i.lane !== 'archive')
  const taskHabit = habits.find((h) => h.id === taskId)
  const task = taskItem ?? taskHabit ?? primary ?? secondary ?? others[0] ?? habits[0]
  const active = timer && task && timer.itemId === task.id ? timer : null

  const firstOtherId = others[0]?.id
  const firstHabitId = habits[0]?.id
  useEffect(() => {
    const existsItem = items.some((i) => i.id === taskId && i.lane !== 'archive')
    const existsHabit = habits.some((h) => h.id === taskId)
    if (taskId && (existsItem || existsHabit)) return
    setTaskId(primary?.id ?? secondary?.id ?? firstOtherId ?? firstHabitId ?? '')
  }, [taskId, items, habits, primary?.id, secondary?.id, firstOtherId, firstHabitId])

  const today = useMemo(() => {
    const days = buildDayStats(sessionsWithLive(sessions, timer), settings, habitRecords)
    return days.get(todayKey())
  }, [sessions, timer, settings, habitRecords])

  const minuteCount = minutes === '' ? 0 : minutes
  const startMinutes = minutes === '' || minutes < 1 ? 1 : Math.min(180, minutes)
  const clockValue =
    settings.timerMode === 'countdown'
      ? (active?.remainingSeconds ?? minuteCount * 60)
      : (active?.elapsedSeconds ?? 0)

  const alarmLabel: Record<AlarmType, string> = {
    off: t.alarmOff,
    chime: t.alarmChime,
    bell: t.alarmBell,
    wood: t.alarmWood,
  }

  const roleLabel = taskHabit
    ? t.habitTime
    : taskItem?.lane === 'primary'
      ? t.primary
      : taskItem?.lane === 'secondary'
        ? t.secondary
        : t.otherTasks

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <select
          className="max-w-[72%] rounded-full border border-line bg-card px-3 py-1.5 text-sm"
          value={task?.id ?? ''}
          onChange={(e) => setTaskId(e.target.value)}
        >
          {!task ? <option value="">{t.pickTask}</option> : null}
          {primary ? (
            <optgroup label={t.primary}>
              <option value={primary.id}>{primary.title}</option>
            </optgroup>
          ) : null}
          {secondary ? (
            <optgroup label={t.secondary}>
              <option value={secondary.id}>{secondary.title}</option>
            </optgroup>
          ) : null}
          {others.length ? (
            <optgroup label={t.otherTasks}>
              {others.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </optgroup>
          ) : null}
          {habits.length ? (
            <optgroup label={t.habitTime}>
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  {habit.title}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <button
          type="button"
          className="rounded-full border border-line px-3 py-1.5 text-xs"
          onClick={() => void patchSettings({ locale: settings.locale === 'zh' ? 'en' : 'zh' })}
        >
          {settings.locale === 'zh' ? 'EN' : '中文'}
        </button>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        {(['countdown', 'countup'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => void patchSettings({ timerMode: mode })}
            className={`rounded-full px-4 py-1.5 text-sm ${settings.timerMode === mode ? 'bg-sage text-paper' : 'border border-line'}`}
          >
            {mode === 'countdown' ? t.countdown : t.countup}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <TimerRing
          value={completion ? 0 : clockValue}
          planned={active?.plannedSeconds || startMinutes * 60}
          mode={settings.timerMode}
          caption={completion ? roleLabel : task ? roleLabel : undefined}
          title={completion ? completion.title : task ? task.title : t.noTask}
          done={Boolean(completion)}
          doneLabel={t.sessionDone}
        />
      </div>

      {settings.timerMode === 'countdown' && !active && !completion ? (
        <label className="mt-2 flex items-center justify-center gap-2 text-sm text-muted">
          {t.minutes}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            value={minutes}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                setMinutes('')
                return
              }
              const n = Number(raw)
              if (!Number.isFinite(n)) return
              setMinutes(Math.min(180, Math.max(0, Math.round(n))))
            }}
            className="w-24 rounded-full border border-line bg-card px-3 py-1.5 text-center text-base text-ink"
          />
        </label>
      ) : null}

      <div className="mt-4 flex justify-center gap-3">
        {completion ? (
          <button
            type="button"
            className="rounded-full bg-sage px-10 py-3 text-paper"
            onClick={() => ackCompletion()}
          >
            {t.confirm}
          </button>
        ) : !task ? null : !active ? (
          <button
            type="button"
            className="rounded-full bg-sage px-10 py-3 text-paper"
            onClick={() => {
              setMinutes(startMinutes)
              void startTimer(task.id, startMinutes, settings.timerMode)
            }}
          >
            {t.start}
          </button>
        ) : active.running ? (
          <button type="button" className="rounded-full border border-line px-8 py-3" onClick={() => void pauseTimer()}>
            {t.pause}
          </button>
        ) : (
          <button type="button" className="rounded-full bg-sage px-8 py-3 text-paper" onClick={() => resumeTimer()}>
            {t.resume}
          </button>
        )}
        {active && !completion ? (
          <button type="button" className="rounded-full border border-line px-8 py-3" onClick={() => void stopTimer()}>
            {t.stop}
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
        <label className="rounded-2xl border border-line bg-card px-3 py-2">
          {t.alarm}
          <select
            className="mt-1 w-full rounded-full border border-line bg-card px-3 py-1.5 text-ink"
            value={settings.alarmType}
            onChange={(e) => void patchSettings({ alarmType: e.target.value as AlarmType })}
          >
            {ALARMS.map((n) => (
              <option key={n} value={n}>
                {alarmLabel[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-line bg-card px-3 py-2">
          {t.scene}
          <select
            className="mt-1 w-full rounded-full border border-line bg-card px-3 py-1.5 text-ink"
            value={settings.scene}
            onChange={(e) => void patchSettings({ scene: e.target.value as Scene })}
          >
            {SCENES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {settings.alarmType !== 'off' ? (
        <div className="mt-2 flex items-end gap-2 text-xs text-muted">
          <label className="block flex-1">
            {t.volume} {Math.round(settings.alarmVolume * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.alarmVolume}
              onChange={(e) => void patchSettings({ alarmVolume: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <button
            type="button"
            className="mb-1 shrink-0 rounded-full border border-line px-3 py-1.5"
            onClick={() => playAlarm(settings.alarmType, settings.alarmVolume)}
          >
            {t.alarmPreview}
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs text-muted">
        {t.primary} {formatDuration(today?.primary ?? 0, settings.locale)} / {settings.primaryMinMinutes}
        {t.minutes}
        {today?.primaryMet ? ` · ${t.met}` : ''}
        {' · '}
        {t.secondary} {formatDuration(today?.secondary ?? 0, settings.locale)} / {settings.secondaryMinMinutes}
        {t.minutes}
        {today?.secondaryMet ? ` · ${t.met}` : ''}
      </p>
      <p className="mt-1 text-center text-xs text-muted">
        {t.otherTime} {formatDuration(today?.other ?? 0, settings.locale)}
        {today?.habitRows.length
          ? ` · ${t.habitTime} ${today.habitMet ? t.met : t.notMet}`
          : ''}
      </p>
    </div>
  )
}
