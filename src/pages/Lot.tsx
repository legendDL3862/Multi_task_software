import { useMemo, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { buildDayStats, sessionsWithLive } from '../lib/stats'
import { allKnownTags, parseTagInput, PRESET_TAGS, tagLabel } from '../lib/tags'
import { formatDuration, todayKey } from '../lib/time'
import { queueItems, slotItem, useAppStore } from '../store/useAppStore'
import type { Item } from '../types'

export function LotPage() {
  const t = useI18n()
  const items = useAppStore((s) => s.items)
  const sessions = useAppStore((s) => s.sessions)
  const timer = useAppStore((s) => s.timer)
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const addItem = useAppStore((s) => s.addItem)
  const updateItem = useAppStore((s) => s.updateItem)
  const promote = useAppStore((s) => s.promote)
  const park = useAppStore((s) => s.park)
  const complete = useAppStore((s) => s.complete)
  const reorderQueue = useAppStore((s) => s.reorderQueue)
  const primary = slotItem(items, 'primary')
  const secondary = slotItem(items, 'secondary')
  const queue = queueItems(items)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [reflux, setReflux] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [composerOpen, setComposerOpen] = useState(false)

  const habits = useAppStore((s) => s.habits)
  const today = useMemo(
    () => buildDayStats(sessionsWithLive(sessions, timer), settings, habits).get(todayKey()),
    [sessions, timer, settings, habits],
  )

  const knownTags = useMemo(
    () => allKnownTags(items.map((i) => i.tags)),
    [items],
  )

  const filteredQueue = useMemo(() => {
    const q = query.trim().toLowerCase()
    return queue.filter((item) => {
      const hay = `${item.title} ${item.content} ${item.tags.map((tag) => tagLabel(tag, settings.locale)).join(' ')}`.toLowerCase()
      const textOk = !q || hay.includes(q) || item.tags.some((tag) => tag.toLowerCase().includes(q))
      const tagOk = filterTags.length === 0 || filterTags.every((tag) => item.tags.includes(tag))
      return textOk && tagOk
    })
  }, [queue, query, filterTags, settings.locale])

  async function submit() {
    await addItem({
      title,
      content,
      tags: draftTags,
      reflux,
    })
    setTitle('')
    setContent('')
    setDraftTags([])
    setReflux(true)
    setComposerOpen(false)
  }

  function toggleTag(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  function onDropSlot(slot: 'primary' | 'secondary') {
    if (!dragging) return
    void promote(dragging, slot)
    setDragging(null)
  }

  function onDropQueue(targetId: string) {
    if (!dragging || dragging === targetId) return
    const ids = queue.map((i) => i.id)
    const from = ids.indexOf(dragging)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(from, 1)
    ids.splice(to, 0, dragging)
    void reorderQueue(ids)
    setDragging(null)
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-medium">{t.lotTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.lotLead}</p>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <label className="rounded-2xl border border-line bg-card px-3 py-2">
          {t.primaryMin}
          <input
            type="number"
            min={1}
            className="mt-1 w-full bg-transparent"
            value={settings.primaryMinMinutes}
            onChange={(e) => void patchSettings({ primaryMinMinutes: Number(e.target.value) || 90 })}
          />
          <span className="text-xs text-muted">{t.minutes}</span>
        </label>
        <label className="rounded-2xl border border-line bg-card px-3 py-2">
          {t.secondaryMin}
          <input
            type="number"
            min={1}
            className="mt-1 w-full bg-transparent"
            value={settings.secondaryMinMinutes}
            onChange={(e) => void patchSettings({ secondaryMinMinutes: Number(e.target.value) || 30 })}
          />
          <span className="text-xs text-muted">{t.minutes}</span>
        </label>
      </section>

      <SlotDrop
        label={t.primary}
        hint={`${t.slotToday} ${formatDuration(today?.primary ?? 0, settings.locale)} / ${settings.primaryMinMinutes}${t.minutes}`}
        item={primary}
        empty={t.emptySlot}
        locale={settings.locale}
        itemTotalLabel={t.itemTotal}
        onDrop={() => onDropSlot('primary')}
        onPark={() => primary && void park(primary.id)}
        onComplete={() => primary && void complete(primary.id)}
        completeLabel={t.complete}
      />
      <div className="h-2" />
      <SlotDrop
        label={t.secondary}
        hint={`${t.slotToday} ${formatDuration(today?.secondary ?? 0, settings.locale)} / ${settings.secondaryMinMinutes}${t.minutes}`}
        item={secondary}
        empty={t.emptySlot}
        locale={settings.locale}
        itemTotalLabel={t.itemTotal}
        onDrop={() => onDropSlot('secondary')}
        onPark={() => secondary && void park(secondary.id)}
        onComplete={() => secondary && void complete(secondary.id)}
        completeLabel={t.complete}
      />

      <div className="mt-5">
        <button
          type="button"
          className="w-full rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-muted"
          onClick={() => setComposerOpen((open) => !open)}
        >
          {composerOpen ? '×' : '+'} {t.addPlan}
        </button>
        {composerOpen ? (
          <form
            className="mt-2 space-y-2 rounded-3xl border border-line bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.title}
              className="w-full bg-transparent outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.content}
              rows={3}
              className="w-full resize-none bg-transparent outline-none"
            />
            <p className="text-xs text-muted">{t.tags}</p>
            <TagChips
              tags={PRESET_TAGS.map((tag) => tag.id)}
              locale={settings.locale}
              selected={draftTags}
              onToggle={(id) => setDraftTags(toggleTag(draftTags, id))}
            />
            <input
              value={draftTags.filter((tag) => !PRESET_TAGS.some((p) => p.id === tag)).join(', ')}
              onChange={(e) => {
                const custom = parseTagInput(e.target.value).filter((tag) => !PRESET_TAGS.some((p) => p.id === tag))
                setDraftTags([...draftTags.filter((tag) => PRESET_TAGS.some((p) => p.id === tag)), ...custom])
              }}
              placeholder={t.tagsHint}
              className="w-full bg-transparent text-sm outline-none"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={reflux} onChange={(e) => setReflux(e.target.checked)} />
              {t.reflux}
            </label>
            <button type="submit" className="rounded-full bg-sage px-4 py-2 text-sm text-paper">
              {t.add}
            </button>
          </form>
        ) : null}
      </div>

      <h2 className="mt-6 text-lg font-medium">{t.queue}</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.searchPlaceholder}
        className="mt-2 w-full rounded-2xl border border-line bg-card px-3 py-2 text-sm outline-none"
      />
      <p className="mt-2 text-xs text-muted">{t.searchTags}</p>
      <TagChips
        tags={knownTags}
        locale={settings.locale}
        selected={filterTags}
        onToggle={(id) => setFilterTags(toggleTag(filterTags, id))}
      />
      <p className="mt-2 text-xs text-muted">{t.dragHint}</p>
      <ul className="mt-3 space-y-2">
        {filteredQueue.map((item) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragging(item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropQueue(item.id)}
            className="rounded-3xl border border-line bg-card p-4"
          >
            <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === item.id ? null : item.id)}>
              <p className="font-medium">{item.title}</p>
              {item.tags.length ? (
                <p className="mt-1 text-xs text-muted">
                  {item.tags.map((tag) => tagLabel(tag, settings.locale)).join(' · ')}
                </p>
              ) : null}
            </button>
            {openId === item.id ? (
              <Editor
                item={item}
                locale={settings.locale}
                t={t}
                onChange={(patch) => void updateItem(item.id, patch)}
              />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => void promote(item.id, 'primary')}>{t.primary}</button>
              <button type="button" onClick={() => void promote(item.id, 'secondary')}>{t.secondary}</button>
              <button type="button" onClick={() => void complete(item.id)}>{t.complete}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TagChips({
  tags,
  locale,
  selected,
  onToggle,
}: {
  tags: string[]
  locale: 'zh' | 'en'
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((id) => {
        const on = selected.includes(id)
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            className={`rounded-full px-2.5 py-1 text-xs ${on ? 'bg-sage text-paper' : 'border border-line'}`}
          >
            {tagLabel(id, locale)}
          </button>
        )
      })}
    </div>
  )
}

function SlotDrop({
  label,
  hint,
  item,
  empty,
  locale,
  itemTotalLabel,
  onDrop,
  onPark,
  onComplete,
  completeLabel,
}: {
  label: string
  hint: string
  item: Item | undefined
  empty: string
  locale: 'zh' | 'en'
  itemTotalLabel: string
  onDrop: () => void
  onPark: () => void
  onComplete: () => void
  completeLabel: string
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="rounded-3xl border border-dashed border-line bg-card p-4"
    >
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="text-xs text-muted">{hint}</p>
      {item ? (
        <>
          <h3 className="mt-2 text-lg">{item.title}</h3>
          <p className="text-sm text-muted">
            {itemTotalLabel} {formatDuration(item.totalSeconds, locale)}
          </p>
          <div className="mt-2 flex gap-3 text-xs">
            <button type="button" onClick={onComplete}>{completeLabel}</button>
            <button type="button" className="text-muted" onClick={onPark}>
              {locale === 'zh' ? '放回排队' : 'Park'}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
    </div>
  )
}

function Editor({
  item,
  locale,
  t,
  onChange,
}: {
  item: Item
  locale: 'zh' | 'en'
  t: ReturnType<typeof useI18n>
  onChange: (patch: Partial<Item>) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={item.content}
        onChange={(e) => onChange({ content: e.target.value })}
        rows={4}
        placeholder={t.content}
        className="w-full rounded-2xl border border-line bg-paper px-3 py-2"
      />
      <TagChips
        tags={PRESET_TAGS.map((tag) => tag.id)}
        locale={locale}
        selected={item.tags}
        onToggle={(id) =>
          onChange({
            tags: item.tags.includes(id) ? item.tags.filter((x) => x !== id) : [...item.tags, id],
          })
        }
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.reflux}
          onChange={(e) => onChange({ reflux: e.target.checked })}
        />
        {t.reflux}
      </label>
    </div>
  )
}
