import { useMemo, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { buildDayStats, sessionsWithLive } from '../lib/stats'
import { allKnownTags, parseTagInput, PRESET_TAGS, tagLabel } from '../lib/tags'
import { formatDuration, todayKey } from '../lib/time'
import { liveHabits, useAppStore } from '../store/useAppStore'
import type { Habit } from '../types'

export function HabitsPage() {
  const t = useI18n()
  const habits = useAppStore((s) => s.habits)
  const sessions = useAppStore((s) => s.sessions)
  const timer = useAppStore((s) => s.timer)
  const settings = useAppStore((s) => s.settings)
  const addHabit = useAppStore((s) => s.addHabit)
  const updateHabit = useAppStore((s) => s.updateHabit)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const reorderHabits = useAppStore((s) => s.reorderHabits)
  const list = liveHabits(habits)
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [dailyMin, setDailyMin] = useState(15)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])

  const today = useMemo(
    () => buildDayStats(sessionsWithLive(sessions, timer), settings, habits).get(todayKey()),
    [sessions, timer, settings, habits],
  )

  const knownTags = useMemo(
    () => allKnownTags(habits.map((h) => h.tags)),
    [habits],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((habit) => {
      const hay = `${habit.title} ${habit.content} ${habit.tags.map((tag) => tagLabel(tag, settings.locale)).join(' ')}`.toLowerCase()
      const textOk = !q || hay.includes(q) || habit.tags.some((tag) => tag.toLowerCase().includes(q))
      const tagOk = filterTags.length === 0 || filterTags.every((tag) => habit.tags.includes(tag))
      return textOk && tagOk
    })
  }, [list, query, filterTags, settings.locale])

  async function submit() {
    await addHabit({ title, content, tags: draftTags, dailyMinMinutes: dailyMin })
    setTitle('')
    setContent('')
    setDraftTags([])
    setDailyMin(15)
    setComposerOpen(false)
  }

  function toggleTag(tags: string[], id: string) {
    return tags.includes(id) ? tags.filter((x) => x !== id) : [...tags, id]
  }

  function onDrop(targetId: string) {
    if (!dragging || dragging === targetId) return
    const ids = list.map((h) => h.id)
    const from = ids.indexOf(dragging)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(from, 1)
    ids.splice(to, 0, dragging)
    void reorderHabits(ids)
    setDragging(null)
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-medium">{t.habitsTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.habitsLead}</p>
      </header>

      <button
        type="button"
        className="w-full rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-muted"
        onClick={() => setComposerOpen((open) => !open)}
      >
        {composerOpen ? '×' : '+'} {t.addHabit}
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
          <label className="block text-sm">
            {t.dailyQuota}
            <input
              type="number"
              min={1}
              className="mt-1 w-full bg-transparent"
              value={dailyMin}
              onChange={(e) => setDailyMin(Number(e.target.value) || 15)}
            />
            <span className="text-xs text-muted">{t.minutes}</span>
          </label>
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
          <button type="submit" className="rounded-full bg-sage px-4 py-2 text-sm text-paper">
            {t.add}
          </button>
        </form>
      ) : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.searchPlaceholder}
        className="mt-4 w-full rounded-2xl border border-line bg-card px-3 py-2 text-sm outline-none"
      />
      <p className="mt-2 text-xs text-muted">{t.searchTags}</p>
      <div className="mt-2">
        <TagChips
          tags={knownTags}
          locale={settings.locale}
          selected={filterTags}
          onToggle={(id) => setFilterTags(toggleTag(filterTags, id))}
        />
      </div>
      <p className="mt-3 text-xs text-muted">{t.dragHint}</p>

      <ul className="mt-3 space-y-2">
        {filtered.map((habit) => {
          const row = today?.habitRows.find((h) => h.id === habit.id)
          return (
            <li
              key={habit.id}
              draggable
              onDragStart={() => setDragging(habit.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(habit.id)}
              className="rounded-3xl border border-line bg-card p-4"
            >
              <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === habit.id ? null : habit.id)}>
                <h3 className="text-lg">{habit.title}</h3>
                <p className="mt-1 text-xs text-muted">
                  {t.today} {formatDuration(row?.seconds ?? 0, settings.locale)} / {habit.dailyMinMinutes}
                  {t.minutes}
                  {row?.met ? ` · ${t.met}` : ` · ${t.notMet}`}
                </p>
              </button>
              {openId === habit.id ? (
                <Editor
                  habit={habit}
                  locale={settings.locale}
                  t={t}
                  onChange={(patch) => void updateHabit(habit.id, patch)}
                  onDelete={() => void deleteHabit(habit.id)}
                />
              ) : null}
            </li>
          )
        })}
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

function Editor({
  habit,
  locale,
  t,
  onChange,
  onDelete,
}: {
  habit: Habit
  locale: 'zh' | 'en'
  t: ReturnType<typeof useI18n>
  onChange: (patch: Partial<Habit>) => void
  onDelete: () => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={habit.content}
        onChange={(e) => onChange({ content: e.target.value })}
        rows={4}
        placeholder={t.content}
        className="w-full rounded-2xl border border-line bg-paper px-3 py-2"
      />
      <label className="block text-sm">
        {t.dailyQuota}
        <input
          type="number"
          min={1}
          className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-2"
          value={habit.dailyMinMinutes}
          onChange={(e) => onChange({ dailyMinMinutes: Number(e.target.value) || 1 })}
        />
      </label>
      <TagChips
        tags={PRESET_TAGS.map((tag) => tag.id)}
        locale={locale}
        selected={habit.tags}
        onToggle={(id) =>
          onChange({
            tags: habit.tags.includes(id) ? habit.tags.filter((x) => x !== id) : [...habit.tags, id],
          })
        }
      />
      <button type="button" className="text-xs text-muted" onClick={onDelete}>
        {t.delete}
      </button>
    </div>
  )
}
