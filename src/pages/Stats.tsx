import { useMemo, useRef } from 'react'
import { useI18n } from '../hooks/useI18n'
import { buildDayStats, lastNDays, monthKeys, sessionsWithLive, sumRange, yearKeys } from '../lib/stats'
import { formatDuration, todayKey } from '../lib/time'
import { useAppStore } from '../store/useAppStore'
import type { BackupPayload } from '../types'

export function StatsPage() {
  const t = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const sessions = useAppStore((s) => s.sessions)
  const timer = useAppStore((s) => s.timer)
  const settings = useAppStore((s) => s.settings)
  const habits = useAppStore((s) => s.habits)
  const exportBackup = useAppStore((s) => s.exportBackup)
  const importBackup = useAppStore((s) => s.importBackup)
  const setToast = useAppStore((s) => s.setToast)
  const now = new Date()
  const days = useMemo(
    () => buildDayStats(sessionsWithLive(sessions, timer), settings, habits),
    [sessions, timer, settings, habits],
  )
  const today = days.get(todayKey())
  const recent = lastNDays(30)
  const month = monthKeys(now.getFullYear(), now.getMonth() + 1)
  const year = yearKeys(now.getFullYear())
  const monthSum = sumRange(days, month)
  const yearSum = sumRange(days, year)
  const allMet = [...days.values()].filter((d) => d.met).length

  async function onExport() {
    const name = `dual-slot-${todayKey()}.json`
    const file = new File([JSON.stringify(await exportBackup(), null, 2)], name, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name })
        setToast(t.exportedToast)
        return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    setToast(t.exportedToast)
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as BackupPayload
      await importBackup(payload)
      setToast(t.importedToast)
    } catch {
      setToast(t.importFailed)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 text-2xl font-medium">{t.statsTitle}</h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" className="rounded-full border border-line px-2.5 py-1 text-xs" onClick={() => void onExport()}>
            {t.exportData}
          </button>
          <button type="button" className="rounded-full border border-line px-2.5 py-1 text-xs" onClick={() => fileRef.current?.click()}>
            {t.importData}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void onImport(file)
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{t.statsRule}</p>

      <section className="mt-5 rounded-3xl border border-line bg-card p-4">
        <h2 className="text-sm text-muted">{t.today}</h2>
        <p className="mt-2 text-3xl font-medium">{formatDuration(today?.total ?? 0, settings.locale)}</p>
        <p className="mt-2 text-sm">
          {t.primary}: {formatDuration(today?.primary ?? 0, settings.locale)} / {settings.primaryMinMinutes}
          {t.minutes} · {today?.primaryMet ? t.met : t.notMet}
        </p>
        <p className="mt-1 text-sm">
          {t.secondary}: {formatDuration(today?.secondary ?? 0, settings.locale)} / {settings.secondaryMinMinutes}
          {t.minutes} · {today?.secondaryMet ? t.met : t.notMet}
        </p>
        <p className="mt-1 text-sm">
          {t.otherTime}: {formatDuration(today?.other ?? 0, settings.locale)}
        </p>
        {today?.habitRows.length ? (
          <div className="mt-3 space-y-1 text-sm">
            <p>
              {t.habitTime}: {formatDuration(today.habit, settings.locale)} · {today.habitMet ? t.met : t.notMet}
            </p>
            {today.habitRows.map((row) => (
              <p key={row.id} className="text-muted">
                {row.title}: {formatDuration(row.seconds, settings.locale)} / {Math.round(row.minSeconds / 60)}
                {t.minutes} · {row.met ? t.met : t.notMet}
              </p>
            ))}
          </div>
        ) : null}
        <p className="mt-3 text-sm">
          {t.requirement}: {today?.met ? t.met : t.notMet}
        </p>
      </section>

      <p className="mt-5 text-sm">
        {t.daysMet}: <strong>{allMet}</strong>
      </p>

      <section className="mt-5">
        <h2 className="text-sm text-muted">{t.heatmap}</h2>
        <div className="mt-2 grid grid-cols-10 gap-1">
          {recent.map((key) => {
            const row = days.get(key)
            const level = !row || row.total === 0 ? 'bg-line' : row.met ? 'bg-sage' : 'bg-clay/60'
            return <div key={key} title={key} className={`h-4 rounded-sm ${level}`} />
          })}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-card p-4">
        <h2 className="text-sm text-muted">{t.month}</h2>
        <p className="mt-2 text-xl">{formatDuration(monthSum.total, settings.locale)}</p>
        <p className="mt-1 text-sm text-muted">
          {t.primary} {formatDuration(monthSum.primary, settings.locale)} · {t.secondary}{' '}
          {formatDuration(monthSum.secondary, settings.locale)} · {t.otherTime}{' '}
          {formatDuration(monthSum.other, settings.locale)} · {t.habitTime}{' '}
          {formatDuration(monthSum.habit, settings.locale)} · {t.daysMet} {monthSum.metDays}
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-card p-4">
        <h2 className="text-sm text-muted">{t.year}</h2>
        <p className="mt-2 text-xl">{formatDuration(yearSum.total, settings.locale)}</p>
        <p className="mt-1 text-sm text-muted">
          {t.primary} {formatDuration(yearSum.primary, settings.locale)} · {t.secondary}{' '}
          {formatDuration(yearSum.secondary, settings.locale)} · {t.otherTime}{' '}
          {formatDuration(yearSum.other, settings.locale)} · {t.habitTime}{' '}
          {formatDuration(yearSum.habit, settings.locale)} · {t.daysMet} {yearSum.metDays}
        </p>
      </section>
    </div>
  )
}
