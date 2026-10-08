import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'
import { Toast } from './Toast'

export function Shell() {
  const t = useI18n()
  const scene = useAppStore((s) => s.settings.scene)
  const tabs = [
    { to: '/', label: t.tabExecute, end: true },
    { to: '/lot', label: t.tabLot },
    { to: '/archive', label: t.tabArchive },
    { to: '/stats', label: t.tabStats },
  ]

  return (
    <div className="flex min-h-dvh justify-center bg-black/80">
      <div
        data-scene={scene}
        className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-paper text-ink"
      >
        <Toast />
        <main className="flex-1 overflow-y-auto px-5 pb-28 pt-5">
          <Outlet />
        </main>
        <footer className="absolute inset-x-0 bottom-0 border-t border-line bg-paper/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
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
