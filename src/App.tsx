import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { ArchivePage } from './pages/Archive'
import { FocusPage } from './pages/Focus'
import { LotPage } from './pages/Lot'
import { StatsPage } from './pages/Stats'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate)
  const ready = useAppStore((s) => s.ready)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper text-muted">
        Dual Slot
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<FocusPage />} />
          <Route path="/lot" element={<LotPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
