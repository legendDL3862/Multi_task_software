import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function Toast() {
  const toast = useAppStore((s) => s.toast)
  const setToast = useAppStore((s) => s.setToast)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast, setToast])

  if (!toast) return null

  return (
    <div className="pointer-events-none absolute inset-x-4 top-3 z-40">
      <div className="rounded-2xl bg-ink px-4 py-3 text-center text-sm text-paper">
        {toast}
      </div>
    </div>
  )
}
