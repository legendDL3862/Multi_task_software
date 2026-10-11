import { useEffect, useMemo, useRef, useState } from 'react'
import { startNoise } from '../audio/noise'
import { TimerRing } from '../components/TimerRing'
import { useI18n } from '../hooks/useI18n'
import { buildDayStats, sessionsWithLive } from '../lib/stats'
import { formatDuration, todayKey } from '../lib/time'
import { queueItems, slotItem, useAppStore } from '../store/useAppStore'
import type { NoiseType, Scene } from '../types'

const SCENES: Scene[] = ['dusk', 'paper', 'forest', 'night', 'sand']
const NOISES: NoiseType[] = ['off', 'white', 'pink', 'brown']

export function FocusPage() {
  const t = useI18n()
  const items = useAppStore((s) => s.items)
  const sessions = useAppStore((s) => s.sessions)
  const timer = useAppStore((s) => s.timer)
  const settings = useAppStore((s) => s.settings)
  const startTimer = useAppStore((s) => s.startTimer)
  const pauseTimer = useAppStore((s) => s.pauseTimer)
  const resumeTimer = useAppStore((s) => s.resumeTimer)
  const stopTimer = useAppStore((s) => s.stopTimer)
  const tickTimer = useAppStore((s) => s.tickTimer)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const addItem = useAppStore((s) => s.addItem)
  const primary = slotItem(items, 'primary')
  const secondary = slotItem(items, 'secondary')
  const others = queueItems(items)
  const selectable = [primary, secondary, ...others].filter(Boolean)
  const [taskId, setTaskId] = useState('')
  const [minutes, setMinutes] = useState(settings.defaultMinutes)
  const [thought, setThought] = useState('')
  const noiseRef = useRef<ReturnType<typeof startNoise>>(null)

  const task = items.find((i) => i.id === taskId && i.lane !== 'archive') ?? selectable[0]
  const active = timer && task && timer.itemId === task.id ? timer : null

  const firstOtherId = others[0]?.id
  useEffect(() => {
    if (taskId && items.some((i) => i.id === taskId && i.lane !== 'archive')) return
    setTaskId(primary?.id ?? secondary?.id ?? firstOtherId ?? '')
  }, [taskId, items, primary?.id, secondary?.id, firstOtherId])

  useEffect(() => {
    const id = window.setInterval(() => void tickTimer(), 1000)
    return () => window.clearInterval(id)
  }, [tickTimer])

  useEffect(() => {
    noiseRef.current?.stop()
    noiseRef.current = null
    if (active?.running) {
      noiseRef.current = startNoise(settings.noiseType, settings.noiseVolume)
    }
    return () => {
      noiseRef.current?.stop()
      noiseRef.current = null
    }
  }, [active?.running, settings.noiseType, settings.noiseVolume])

  const today = useMemo(() => {
    const days = buildDayStats(sessionsWithLive(sessions, timer), settings)
    return days.get(todayKey())
  }, [sessions, timer, settings])

  const clockValue =
    settings.timerMode === 'countdown'
      ? (active?.remainingSeconds ?? minutes * 60)
      : (active?.elapsedSeconds ?? 0)

  const noiseLabel: Record<NoiseType, string> = {
    off: t.noiseOff,
    white: t.noiseWhite,
    pink: t.noisePink,
    brown: t.noiseBrown,
  }

  const roleLabel =
    task?.lane === 'primary' ? t.primary : task?.lane === 'secondary' ? t.secondary : t.otherTasks

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
          value={clockValue}
          planned={active?.plannedSeconds || minutes * 60}
          mode={settings.timerMode}
          caption={task ? roleLabel : undefined}
          title={task ? task.title : t.noTask}
        />
      </div>

      {settings.timerMode === 'countdown' && !active ? (
        <label className="mt-2 block text-center text-sm text-muted">
          {minutes} {t.minutes}
          <input
            type="range"
            min={1}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>
      ) : null}

      <div className="mt-4 flex justify-center gap-3">
        {!task ? null : !active ? (
          <button
            type="button"
            className="rounded-full bg-sage px-10 py-3 text-paper"
            onClick={() => void startTimer(task.id, minutes, settings.timerMode)}
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
        {active ? (
          <button type="button" className="rounded-full border border-line px-8 py-3" onClick={() => void stopTimer()}>
            {t.stop}
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
        <label className="rounded-2xl border border-line bg-card px-3 py-2">
          {t.noise}
          <select
            className="mt-1 w-full bg-transparent"
            value={settings.noiseType}
            onChange={(e) => void patchSettings({ noiseType: e.target.value as NoiseType })}
          >
            {NOISES.map((n) => (
              <option key={n} value={n}>
                {noiseLabel[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-line bg-card px-3 py-2">
          {t.scene}
          <select
            className="mt-1 w-full bg-transparent"
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
      {settings.noiseType !== 'off' ? (
        <label className="mt-2 block text-xs text-muted">
          {t.volume} {Math.round(settings.noiseVolume * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.noiseVolume}
            onChange={(e) => void patchSettings({ noiseVolume: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
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
      </p>

      {active ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-3">
          <input
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void addItem({ title: thought })
                setThought('')
              }
            }}
            placeholder={t.parked}
            className="w-full bg-transparent outline-none"
          />
        </div>
      ) : null}
    </div>
  )
}
