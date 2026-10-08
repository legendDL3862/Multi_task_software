import { useI18n } from '../hooks/useI18n'
import { formatDate, formatDuration } from '../lib/time'
import { useAppStore } from '../store/useAppStore'

export function ArchivePage() {
  const t = useI18n()
  const items = useAppStore((s) => s.items)
  const locale = useAppStore((s) => s.settings.locale)
  const restore = useAppStore((s) => s.restore)
  const deleteItem = useAppStore((s) => s.deleteItem)
  const list = items
    .filter((i) => i.lane === 'archive')
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-medium">{t.archiveTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.archiveLead}</p>
      </header>
      <ul className="space-y-3">
        {list.map((item) => (
          <li key={item.id} className="rounded-3xl border border-line bg-card p-4">
            <h2 className="text-lg">{item.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {t.duration} {formatDuration(item.totalSeconds, locale)}
              {item.completedAt ? ` · ${formatDate(item.completedAt, locale)}` : ''}
              {` · ${item.sessionCount} ${t.sessions}`}
            </p>
            {item.content ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.content}</p> : null}
            {item.tags.length ? <p className="mt-1 text-xs text-muted">{item.tags.join(' · ')}</p> : null}
            <div className="mt-3 flex gap-3 text-sm">
              <button type="button" onClick={() => void restore(item.id)}>
                {t.restore}
              </button>
              <button type="button" className="text-muted" onClick={() => void deleteItem(item.id)}>
                {t.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 ? <p className="mt-8 text-sm text-muted">{t.archiveEmpty}</p> : null}
    </div>
  )
}
