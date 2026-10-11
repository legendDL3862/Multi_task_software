import { useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'
import { Toast } from './Toast'

const PATHS = ['/', '/lot', '/archive', '/stats'] as const

export function Shell() {
  const t = useI18n()
  const scene = useAppStore((s) => s.settings.scene)
  const location = useLocation()
  const navigate = useNavigate()
  const start = useRef<{ x: number; y: number } | null>(null)
  const tabs = [
    { to: '/', label: t.tabExecute, end: true },
    { to: '/lot', label: t.tabLot },
    { to: '/archive', label: t.tabArchive },
    { to: '/stats', label: t.tabStats },
  ]

  function onTouchStart(e: React.TouchEvent) {
    const el = e.target as HTMLElement
    if (el.closest('input, textarea, select, [draggable="true"]')) {
      start.current = null
      return
    }
    const touch = e.changedTouches[0]
    start.current = { x: touch.clientX, y: touch.clientY }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!start.current) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - start.current.x
    const dy = touch.clientY - start.current.y
    start.current = null
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.15) return
    const index = PATHS.indexOf(location.pathname as (typeof PATHS)[number])
    if (index < 0) return
    if (dx < 0 && index < PATHS.length - 1) navigate(PATHS[index + 1])
    if (dx > 0 && index > 0) navigate(PATHS[index - 1])
  }

  return (
    <div className="flex h-dvh justify-center overflow-hidden bg-black/80">
      <div
        data-scene={scene}
        className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-paper text-ink"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Toast />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-4 pt-5">
          <Outlet />
        </main>
        <footer className="z-20 shrink-0 border-t border-line bg-paper px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
          <nav className="grid grid-cols-4 gap-1 text-center text-xs">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `rounded-xl py-2.5 ${isActive ? 'bg-soft text-ink' : 'text-muted'}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  )
}
