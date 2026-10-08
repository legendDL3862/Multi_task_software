export const PRESET_TAGS = [
  { id: 'study', zh: '学习', en: 'Study' },
  { id: 'exercise', zh: '锻炼', en: 'Exercise' },
  { id: 'play', zh: '娱乐', en: 'Fun' },
  { id: 'work', zh: '工作', en: 'Work' },
  { id: 'reading', zh: '阅读', en: 'Reading' },
  { id: 'life', zh: '生活', en: 'Life' },
  { id: 'create', zh: '创作', en: 'Create' },
  { id: 'rest', zh: '休息', en: 'Rest' },
] as const

export type PresetTagId = (typeof PRESET_TAGS)[number]['id']

export function tagLabel(id: string, locale: 'zh' | 'en'): string {
  const preset = PRESET_TAGS.find((t) => t.id === id)
  if (preset) return preset[locale]
  return id
}

export function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const hit = PRESET_TAGS.find((t) => t.id === s || t.zh === s || t.en.toLowerCase() === s.toLowerCase())
      return hit?.id ?? s
    })
}

export function allKnownTags(itemTags: string[][]): string[] {
  const set = new Set<string>(PRESET_TAGS.map((t) => t.id))
  for (const list of itemTags) {
    for (const tag of list) set.add(tag)
  }
  return [...set]
}
