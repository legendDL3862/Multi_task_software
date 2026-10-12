import type { AlarmType, MusicSource, NoiseType } from '../types'

type Handle = {
  setVolume: (v: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

function fillNoise(data: Float32Array, type: Exclude<NoiseType, 'off'>) {
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    if (type === 'white') {
      data[i] = white * 0.4
    } else if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      data[i] = (b0 + b1 + b2 + white * 0.3) * 0.12
    } else {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
  }
}

export function startNoise(type: MusicSource, volume: number): Handle | null {
  if (type === 'off' || type === 'folder') return null
  const ctx = new AudioContext()
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  fillNoise(buffer.getChannelData(0), type)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = Math.max(0, volume)
  source.connect(gain)
  gain.connect(ctx.destination)
  void ctx.resume()
  source.start()
  return {
    setVolume: (v) => {
      gain.gain.value = Math.max(0, v)
    },
    pause: () => {
      void ctx.suspend()
    },
    resume: () => {
      void ctx.resume()
    },
    stop: () => {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
      void ctx.close()
    },
  }
}

let loopBeat: number | null = null
let loopLimit: number | null = null

export function stopAlarmLoop() {
  if (loopBeat != null) window.clearInterval(loopBeat)
  if (loopLimit != null) window.clearTimeout(loopLimit)
  loopBeat = null
  loopLimit = null
}

export function startAlarmLoop(type: AlarmType, volume: number, durationMs: number, onDone?: () => void) {
  stopAlarmLoop()
  const finish = () => {
    stopAlarmLoop()
    onDone?.()
  }
  if (type !== 'off' && volume > 0) {
    playAlarm(type, volume)
    const gap = type === 'wood' ? 450 : type === 'bell' ? 1100 : 1300
    loopBeat = window.setInterval(() => playAlarm(type, volume), gap)
  }
  loopLimit = window.setTimeout(finish, durationMs)
}

export function playAlarm(type: AlarmType, volume = 0.4) {
  if (type === 'off' || volume <= 0) return
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)
  const now = ctx.currentTime

  if (type === 'wood') {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      last = last * 0.92 + (Math.random() * 2 - 1) * 0.08
      data[i] = last * (1 - i / data.length)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(master)
    src.start(now)
    src.stop(now + 0.12)
    src.onended = () => void ctx.close()
    return
  }

  const notes = type === 'bell' ? [523.25, 659.25, 783.99] : [528, 396]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type === 'bell' ? 'triangle' : 'sine'
    osc.frequency.value = freq
    const start = now + i * 0.22
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + 0.75)
    if (i === notes.length - 1) osc.onended = () => void ctx.close()
  })
}
