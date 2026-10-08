import { formatClock } from '../lib/time'

type Props = {
  value: number
  planned: number
  mode: 'countup' | 'countdown'
  label?: string
}

export function TimerRing({ value, planned, mode, label }: Props) {
  const r = 118
  const c = 2 * Math.PI * r
  const ratio =
    mode === 'countdown' && planned > 0
      ? Math.max(0, Math.min(1, value / planned))
      : Math.max(0, Math.min(1, (value % 3600) / 3600))

  return (
    <div className="relative mx-auto grid size-[300px] place-items-center">
      <svg className="size-full -rotate-90" viewBox="0 0 280 280" aria-hidden>
        <circle cx="140" cy="140" r={r} fill="none" className="stroke-line" strokeWidth="10" />
        <circle
          cx="140"
          cy="140"
          r={r}
          fill="none"
          className="stroke-sage"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-medium tracking-tight text-[64px] leading-none text-ink tabular-nums">
            {formatClock(value)}
          </div>
          {label ? <div className="mt-3 text-sm text-muted">{label}</div> : null}
        </div>
      </div>
    </div>
  )
}
