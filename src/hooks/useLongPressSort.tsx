import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

const TOUCH_HOLD_MS = 1000
const CANCEL_PX = 14
const RELEASE_MS = 50

type Slot = 'primary' | 'secondary'

export type SortGhost = {
  title: string
  width: number
  height: number
}

function findScroller(from: HTMLElement | null) {
  let node: HTMLElement | null = from
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll') return node
    node = node.parentElement
  }
  return document.querySelector('main')
}

function hitAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y)
  const item = el?.closest('[data-sort-id]')
  const slot = el?.closest('[data-sort-slot]')
  return {
    itemId: item?.getAttribute('data-sort-id'),
    slot: (slot?.getAttribute('data-sort-slot') as Slot | null) ?? null,
  }
}

function listItems() {
  return [...document.querySelectorAll('[data-sort-list] [data-sort-id]')] as HTMLElement[]
}

function insertIndexAt(y: number, activeId: string) {
  const others = listItems().filter((node) => node.dataset.sortId !== activeId)
  for (let i = 0; i < others.length; i++) {
    const rect = others[i].getBoundingClientRect()
    const shift = Number(others[i].dataset.sortShift || 0)
    const top = rect.top - shift
    const height = rect.height
    if (y < top + height / 2) return i
  }
  return others.length
}

function collapseActive(el: HTMLElement) {
  el.style.opacity = '0'
  el.style.height = '0px'
  el.style.minHeight = '0px'
  el.style.padding = '0px'
  el.style.margin = '0px'
  el.style.borderWidth = '0px'
  el.style.overflow = 'hidden'
  el.style.pointerEvents = 'none'
}

function paintShift(activeId: string, insertIndex: number | null, height: number) {
  const items = listItems()
  const active = items.find((node) => node.dataset.sortId === activeId)
  if (active) collapseActive(active)
  const others = items.filter((node) => node.dataset.sortId !== activeId)
  others.forEach((el, i) => {
    const shift = insertIndex != null && i >= insertIndex ? height + 8 : 0
    el.dataset.sortShift = String(shift)
    el.style.transform = shift ? `translateY(${shift}px)` : ''
  })
}

function clearShift() {
  listItems().forEach((el) => {
    el.style.transform = ''
    el.style.opacity = ''
    el.style.height = ''
    el.style.minHeight = ''
    el.style.padding = ''
    el.style.margin = ''
    el.style.borderWidth = ''
    el.style.overflow = ''
    el.style.pointerEvents = ''
    delete el.dataset.sortShift
  })
}

let ghostNode: HTMLDivElement | null = null

function showGhost(ghost: SortGhost, x: number, y: number) {
  if (!ghostNode) {
    ghostNode = document.createElement('div')
    ghostNode.dataset.sortGhost = '1'
    ghostNode.className =
      'pointer-events-none fixed z-50 rounded-3xl border border-sage bg-card px-4 py-4 shadow-lg'
    const title = document.createElement('p')
    title.className = 'font-medium'
    ghostNode.appendChild(title)
    document.body.appendChild(ghostNode)
  }
  const title = ghostNode.firstChild as HTMLElement
  title.textContent = ghost.title
  ghostNode.style.width = `${ghost.width}px`
  ghostNode.style.minHeight = `${ghost.height}px`
  ghostNode.style.left = `${x}px`
  ghostNode.style.top = `${y}px`
  ghostNode.style.transform = 'scale(1.03)'
}

function moveGhost(x: number, y: number) {
  if (!ghostNode) return
  ghostNode.style.left = `${x}px`
  ghostNode.style.top = `${y}px`
}

function hideGhost() {
  ghostNode?.remove()
  ghostNode = null
}

export function SortGhostCard(_props?: { ghost?: unknown }) {
  return null
}

export function useLongPressSort(handlers: {
  onReorder: (activeId: string, beforeId: string | null) => void
  onSlot?: (activeId: string, slot: Slot) => void
}) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const startRef = useRef<{
    x: number
    y: number
    id: string
    pointerType: string
    offsetX: number
    offsetY: number
    width: number
    height: number
    title: string
  } | null>(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const scrollerRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef(0)
  const releaseRef = useRef(0)
  const armedRef = useRef(false)
  const lastIndexRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overSlot, setOverSlot] = useState<Slot | null>(null)

  function clearTimer() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = 0
  }

  function clearRelease() {
    if (releaseRef.current) window.clearTimeout(releaseRef.current)
    releaseRef.current = 0
  }

  function unlockPage() {
    document.documentElement.removeAttribute('data-sorting')
    document.documentElement.style.touchAction = ''
    document.body.style.touchAction = ''
    document.body.style.overflow = ''
    document.querySelectorAll<HTMLElement>('main, [data-sort-locked]').forEach((node) => {
      node.style.overflowY = node.dataset.sortOverflow ?? ''
      node.style.touchAction = ''
      delete node.dataset.sortOverflow
      node.removeAttribute('data-sort-locked')
    })
  }

  function lockPage(scroller: HTMLElement | null) {
    document.documentElement.setAttribute('data-sorting', '1')
    document.documentElement.style.touchAction = 'none'
    document.body.style.touchAction = 'none'
    document.body.style.overflow = 'hidden'
    const target = scroller ?? document.querySelector('main')
    if (target && !target.hasAttribute('data-sort-locked')) {
      target.dataset.sortOverflow = target.style.overflowY
      target.setAttribute('data-sort-locked', '1')
      target.style.overflowY = 'hidden'
      target.style.touchAction = 'none'
    }
  }

  function dropAtPointer() {
    const start = startRef.current
    if (!start || !armedRef.current) return
    const { x, y } = pointerRef.current
    const hit = hitAt(x, y)
    if (hit.slot && handlersRef.current.onSlot) {
      handlersRef.current.onSlot(start.id, hit.slot)
      return
    }
    const others = listItems().filter((node) => node.dataset.sortId !== start.id)
    const index = insertIndexAt(y, start.id)
    handlersRef.current.onReorder(start.id, others[index]?.dataset.sortId ?? null)
  }

  function disarm() {
    clearTimer()
    clearRelease()
    armedRef.current = false
    startRef.current = null
    scrollerRef.current = null
    lastIndexRef.current = null
    hideGhost()
    clearShift()
    unlockPage()
    setActiveId(null)
    setOverSlot(null)
  }

  function placeFromPointer() {
    const start = startRef.current
    if (!start) return
    const { x, y } = pointerRef.current
    moveGhost(x - start.offsetX, y - start.offsetY)
    const hit = hitAt(x, y)
    const nextSlot = hit.slot
    const nextIndex = insertIndexAt(y, start.id)
    setOverSlot(nextSlot)
    if (nextIndex !== lastIndexRef.current) {
      lastIndexRef.current = nextIndex
      paintShift(start.id, nextIndex, start.height)
    }
  }

  function arm(id: string) {
    const start = startRef.current
    if (!start || start.id !== id) return
    armedRef.current = true
    suppressClickRef.current = true
    lockPage(scrollerRef.current)
    setActiveId(id)
    showGhost(
      { title: start.title, width: start.width, height: start.height },
      pointerRef.current.x - start.offsetX,
      pointerRef.current.y - start.offsetY,
    )
    lastIndexRef.current = null
    placeFromPointer()
    try {
      navigator.vibrate?.(12)
    } catch {
      /* ignore */
    }
  }

  function finish() {
    dropAtPointer()
    disarm()
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  function scheduleFinish() {
    clearRelease()
    releaseRef.current = window.setTimeout(() => {
      releaseRef.current = 0
      finish()
    }, RELEASE_MS)
  }

  useEffect(() => {
    function onFingerUp() {
      if (!startRef.current && !armedRef.current) return
      scheduleFinish()
    }

    function onMove(e: PointerEvent) {
      pointerRef.current = { x: e.clientX, y: e.clientY }
      const start = startRef.current
      if (!start) return
      if (releaseRef.current) clearRelease()
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (!armedRef.current) {
        if (dist > CANCEL_PX) clearTimer()
        if (start.pointerType !== 'touch' && dist > 8) arm(start.id)
        return
      }
      placeFromPointer()
    }

    function onTouchMove(e: TouchEvent) {
      if (!startRef.current && !armedRef.current) return
      const touch = e.touches[0]
      if (!touch) return
      if (releaseRef.current) clearRelease()
      pointerRef.current = { x: touch.clientX, y: touch.clientY }
      const start = startRef.current
      if (!armedRef.current) {
        if (!start) return
        const dist = Math.hypot(touch.clientX - start.x, touch.clientY - start.y)
        if (dist > CANCEL_PX) clearTimer()
        return
      }
      e.preventDefault()
      placeFromPointer()
    }

    const opts = { capture: true } as const
    window.addEventListener('pointermove', onMove, opts)
    window.addEventListener('pointerup', onFingerUp, opts)
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    window.addEventListener('touchend', onFingerUp, opts)
    return () => {
      window.removeEventListener('pointermove', onMove, opts)
      window.removeEventListener('pointerup', onFingerUp, opts)
      window.removeEventListener('touchmove', onTouchMove, true)
      window.removeEventListener('touchend', onFingerUp, opts)
      hideGhost()
      clearShift()
      unlockPage()
    }
  }, [])

  function itemProps(id: string) {
    return {
      'data-sort-id': id,
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0) return
        if ((e.target as HTMLElement).closest('input, textarea, select, a, [data-no-drag]')) return
        const el = e.currentTarget as HTMLElement
        const rect = el.getBoundingClientRect()
        const title =
          el.querySelector('p.font-medium, h3')?.textContent?.trim() ||
          el.textContent?.trim().slice(0, 40) ||
          ''
        pointerRef.current = { x: e.clientX, y: e.clientY }
        scrollerRef.current = findScroller(el)
        startRef.current = {
          x: e.clientX,
          y: e.clientY,
          id,
          pointerType: e.pointerType,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
          width: rect.width,
          height: rect.height,
          title,
        }
        clearTimer()
        clearRelease()
        if (e.pointerType === 'touch') {
          timerRef.current = window.setTimeout(() => arm(id), TOUCH_HOLD_MS)
        }
      },
      onClickCapture: (e: MouseEvent) => {
        if (!suppressClickRef.current) return
        e.preventDefault()
        e.stopPropagation()
      },
    }
  }

  function slotProps(slot: Slot) {
    return { 'data-sort-slot': slot }
  }

  return { activeId, insertIndex: lastIndexRef.current, overSlot, ghostHeight: startRef.current?.height ?? 72, itemProps, slotProps }
}
