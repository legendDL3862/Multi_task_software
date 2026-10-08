import type { NoiseType } from '../types'

type Handle = {
  setVolume: (v: number) => void
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

export function startNoise(type: NoiseType, volume: number): Handle | null {
  if (type === 'off' || volume <= 0) return null
  const ctx = new AudioContext()
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  fillNoise(buffer.getChannelData(0), type)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(ctx.destination)
  void ctx.resume()
  source.start()
  return {
    setVolume: (v) => {
      gain.gain.value = v
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

export function playChime() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 528
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 1.3)
  osc.onended = () => {
    void ctx.close()
  }
}
