import { formatClock } from '../lib/time'

type Props = {
  value: number
  planned: number
  mode: 'countup' | 'countdown'
  caption?: string
  title?: string
  done?: boolean
  doneLabel?: string
}

export function TimerRing({ value, planned, mode, caption, title, done, doneLabel }: Props) {
  const r = 118
  const c = 2 * Math.PI * r
  const ratio = done
    ? 1
    : mode === 'countdown' && planned > 0
      ? Math.max(0, Math.min(1, value / planned))
      : Math.max(0, Math.min(1, (value % 3600) / 3600))
  const clock = formatClock(value)
  const timeClass = done
    ? 'text-[28px] sm:text-[32px]'
    : clock.length > 5
      ? 'text-[32px] sm:text-[36px]'
      : 'text-[44px] sm:text-[48px]'

  return (
    <div className="relative mx-auto grid size-[280px] place-items-center sm:size-[300px]">
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
      <div className="absolute inset-[22%] grid place-items-center overflow-hidden text-center">
        <div className="max-w-full">
          <div className={`font-medium tracking-tight leading-none text-ink ${done ? '' : 'tabular-nums'} ${timeClass}`}>
            {done ? doneLabel : clock}
          </div>
          {caption ? <p className="mt-2 text-[11px] leading-none text-muted">{caption}</p> : null}
          {title ? (
            <p className="mt-1 line-clamp-2 break-words text-xs leading-snug text-ink">{title}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
