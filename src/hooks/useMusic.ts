import { useSyncExternalStore } from 'react'
import { getMusicSnapshot, subscribeMusic } from '../lib/music'

export function useMusic() {
  return useSyncExternalStore(subscribeMusic, getMusicSnapshot, getMusicSnapshot)
}
