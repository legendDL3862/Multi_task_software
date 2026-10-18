export function applyInsert(ids: string[], activeId: string, beforeId: string | null) {
  const next = ids.filter((id) => id !== activeId)
  if (!beforeId) {
    next.push(activeId)
    return next
  }
  const at = next.indexOf(beforeId)
  if (at < 0) next.push(activeId)
  else next.splice(at, 0, activeId)
  return next
}
