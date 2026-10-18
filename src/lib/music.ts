import { startNoise } from '../audio/noise'
import {
  canPickNativeMusicFolder,
  isNativeMusicUri,
  listNativeMusicFolder,
  loadNativeMusicFile,
  pickNativeMusicFolder,
  type NativeFolder,
} from './nativeMusic'
import type { MusicSource, PlayMode } from '../types'

const AUDIO = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i
const HANDLE_DB = 'dual-slot-music'
const MAX_TRACKS = 300
const MAX_DEPTH = 3

type Track = {
  name: string
  load: () => Promise<Blob | ArrayBuffer | string>
}

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: 'read' }) => Promise<PermissionState>
  requestPermission?: (descriptor?: { mode?: 'read' }) => Promise<PermissionState>
}

export type MusicSnapshot = {
  source: MusicSource
  playing: boolean
  active: boolean
  trackName: string | null
  index: number
  count: number
  current: number
  duration: number
}

const listeners = new Set<() => void>()

let tracks: Track[] = []
let objectUrl: string | null = null
let audio: HTMLAudioElement | null = null
let index = 0
let loadedIndex = -1
let playGen = 0
let source: MusicSource = 'off'
let playMode: PlayMode = 'sequence'
let volume = 0.18
let duck = 1
let playing = false
let wantPlay = false
let sessionLive = false
let noise: ReturnType<typeof startNoise> = null
let snapshot: MusicSnapshot = {
  source: 'off',
  playing: false,
  active: false,
  trackName: null,
  index: 0,
  count: 0,
  current: 0,
  duration: 0,
}

function readSnapshot(): MusicSnapshot {
  return {
    source,
    playing,
    active: sessionLive && source !== 'off',
    trackName: tracks[index]?.name ?? null,
    index,
    count: tracks.length,
    current: audio?.currentTime ?? 0,
    duration: Number.isFinite(audio?.duration) ? (audio?.duration ?? 0) : 0,
  }
}

function emit() {
  snapshot = readSnapshot()
  listeners.forEach((fn) => fn())
}

export function subscribeMusic(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getMusicSnapshot(): MusicSnapshot {
  return snapshot
}

function revoke() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

function isAudioName(name: string) {
  return AUDIO.test(name)
}

function audibleVolume() {
  return Math.min(1, Math.max(0, volume * duck))
}

function clearMediaSession() {
  const session = navigator.mediaSession
  if (!session) return
  try {
    session.metadata = null
    session.playbackState = 'none'
  } catch {
    /* ignore */
  }
}

function bindHeadsetSkip() {
  const session = navigator.mediaSession
  if (!session) return
  try {
    session.setActionHandler('previoustrack', () => {
      void skipTrack(-1)
    })
    session.setActionHandler('nexttrack', () => {
      void skipTrack(1)
    })
    session.setActionHandler('play', () => {
      void playMusic()
    })
    session.setActionHandler('pause', () => {
      pauseMusic()
    })
  } catch {
    /* ignore */
  }
}

function ensureAudio() {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'auto'
  audio.crossOrigin = 'anonymous'
  audio.setAttribute('playsinline', 'true')
  audio.disableRemotePlayback = true
  clearMediaSession()
  audio.addEventListener('ended', () => {
    const el = audio
    if (!el) return
    if (playMode === 'loop') {
      el.currentTime = 0
      if (wantPlay) void el.play()
      return
    }
    void skipTrack(1)
  })
  audio.addEventListener('timeupdate', () => {
    if (Math.floor(audio?.currentTime ?? 0) === Math.floor(snapshot.current)) return
    emit()
  })
  audio.addEventListener('loadedmetadata', emit)
  audio.addEventListener('play', () => {
    playing = true
    emit()
  })
  audio.addEventListener('pause', () => {
    if (source === 'folder') playing = false
    emit()
  })
  return audio
}

function stopNoise() {
  noise?.stop()
  noise = null
}

function pauseFolder() {
  audio?.pause()
}

async function playIndex(nextIndex: number) {
  if (!tracks.length) return
  const gen = playGen
  index = (nextIndex + tracks.length) % tracks.length
  const track = tracks[index]
  const el = ensureAudio()
  el.muted = false
  el.volume = audibleVolume()
  bindHeadsetSkip()
  if (loadedIndex !== index) {
    revoke()
    const payload = await track.load()
    if (gen !== playGen || tracks[index] !== track) return
    if (typeof payload === 'string') {
      el.src = payload
    } else {
      const blob = payload instanceof Blob ? payload : new Blob([payload])
      objectUrl = URL.createObjectURL(blob)
      el.src = objectUrl
    }
    loadedIndex = index
  }
  emit()
  if (wantPlay && gen === playGen) {
    try {
      await el.play()
      clearMediaSession()
    } catch {
      if (gen !== playGen) return
      playing = false
      emit()
    }
  }
}

async function applySource() {
  stopNoise()
  pauseFolder()
  playing = false
  if (source === 'off' || source === 'folder') {
    emit()
    return
  }
  noise = startNoise(source, audibleVolume())
  if (wantPlay) {
    noise?.resume()
    playing = true
  } else {
    noise?.pause()
  }
  emit()
}

export function setMusicSource(next: MusicSource) {
  if (source === next) return
  source = next
  if (next === 'off') {
    wantPlay = false
    sessionLive = false
  }
  void applySource()
  if (wantPlay && source === 'folder') void playIndex(index)
}

export function setPlayMode(next: PlayMode) {
  playMode = next
}

function nextShuffleIndex() {
  if (tracks.length <= 1) return 0
  let next = index
  while (next === index) next = Math.floor(Math.random() * tracks.length)
  return next
}

export function setMusicVolume(next: number) {
  volume = Math.min(1, Math.max(0, next))
  if (audio) audio.volume = audibleVolume()
  noise?.setVolume(audibleVolume())
  emit()
}

export function setMusicDuck(on: boolean) {
  duck = on ? 0.12 : 1
  if (audio) audio.volume = audibleVolume()
  noise?.setVolume(audibleVolume())
}

export async function playMusic(nextSource?: MusicSource) {
  if (nextSource) source = nextSource
  wantPlay = source !== 'off'
  sessionLive = wantPlay
  if (source === 'off') {
    playing = false
    sessionLive = false
    emit()
    return
  }
  if (source === 'folder') {
    if (!tracks.length) {
      wantPlay = false
      sessionLive = false
      playing = false
      emit()
      return
    }
    await playIndex(index)
    return
  }
  stopNoise()
  noise = startNoise(source, audibleVolume())
  noise?.resume()
  playing = true
  emit()
}

export function pauseMusic() {
  wantPlay = false
  playing = false
  noise?.pause()
  pauseFolder()
  emit()
}

export function toggleMusic() {
  if (playing) pauseMusic()
  else void playMusic()
}

export async function skipTrack(delta: number) {
  if (!tracks.length || source !== 'folder') return
  loadedIndex = -1
  if (playMode === 'shuffle' && tracks.length > 1) {
    await playIndex(nextShuffleIndex())
    return
  }
  await playIndex(index + delta)
}

export function skipSeconds(delta: number) {
  if (!audio || source !== 'folder') return
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0
  const next = Math.max(0, audio.currentTime + delta)
  if (duration && next >= duration - 0.05) {
    if (playMode === 'loop') {
      audio.currentTime = 0
      emit()
      return
    }
    void skipTrack(1)
    return
  }
  audio.currentTime = next
  emit()
}

export function seekMusic(seconds: number) {
  if (!audio || source !== 'folder') return
  audio.currentTime = Math.max(0, seconds)
  emit()
}

function setTracks(next: Track[]) {
  playGen += 1
  wantPlay = false
  playing = false
  pauseFolder()
  revoke()
  loadedIndex = -1
  tracks = next
  index = 0
  if (audio) {
    audio.removeAttribute('src')
    audio.load()
  }
  emit()
}

async function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('handles')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDirHandle(handle: FileSystemDirectoryHandle) {
  const db = await openHandleDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(handle, 'folder')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb()
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly')
      const req = tx.objectStore('handles').get('folder')
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return handle
  } catch {
    return null
  }
}

async function collectFromDirectory(
  dir: FileSystemDirectoryHandle,
  depth: number,
  acc: Track[],
): Promise<void> {
  if (depth > MAX_DEPTH || acc.length >= MAX_TRACKS) return
  const entries: { name: string; handle: FileSystemHandle }[] = []
  for await (const [name, handle] of dir.entries()) {
    entries.push({ name, handle })
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  for (const { name, handle } of entries) {
    if (acc.length >= MAX_TRACKS) break
    if (handle.kind === 'directory') {
      await collectFromDirectory(handle as FileSystemDirectoryHandle, depth + 1, acc)
    } else if (handle.kind === 'file' && isAudioName(name)) {
      const fileHandle = handle as FileSystemFileHandle
      acc.push({
        name,
        load: async () => fileHandle.getFile(),
      })
    }
  }
}

async function collectFromElectron(dir: string): Promise<Track[]> {
  const desktop = window.dualSlotDesktop
  if (!desktop) return []
  const list = await desktop.listMusic(dir)
  return list.slice(0, MAX_TRACKS).map((row) => ({
    name: row.name,
    load: () => desktop.readMusic(row.path),
  }))
}

function applyNativeFolder(folder: NativeFolder) {
  setTracks(
    folder.files.slice(0, MAX_TRACKS).map((row) => ({
      name: row.name,
      load: () => loadNativeMusicFile(row.uri),
    })),
  )
}

export async function pickMusicFolder(): Promise<{ label: string; path: string; count: number } | null> {
  if (canPickNativeMusicFolder()) {
    try {
      const folder = await pickNativeMusicFolder()
      applyNativeFolder(folder)
      return { label: folder.label, path: folder.uri, count: tracks.length }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/cancel/i.test(msg)) return null
    }
  }

  const desktop = window.dualSlotDesktop
  if (desktop) {
    const dir = await desktop.pickMusicFolder()
    if (!dir) return null
    setTracks(await collectFromElectron(dir))
    return { label: dir, path: dir, count: tracks.length }
  }

  if (typeof window.showDirectoryPicker === 'function') {
    const handle = await window.showDirectoryPicker({ mode: 'read' })
    await saveDirHandle(handle)
    const next: Track[] = []
    await collectFromDirectory(handle, 0, next)
    setTracks(next)
    return { label: handle.name, path: '', count: tracks.length }
  }

  return null
}

export function supportsDirectoryPicker() {
  return (
    canPickNativeMusicFolder() ||
    Boolean(window.dualSlotDesktop) ||
    typeof window.showDirectoryPicker === 'function'
  )
}

export function ingestMusicFiles(files: FileList | File[]): { label: string; count: number } {
  const list = [...files].filter((f) => isAudioName(f.name) || isAudioName(f.webkitRelativePath || ''))
  list.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  setTracks(
    list.slice(0, MAX_TRACKS).map((file) => ({
      name: file.name,
      load: async () => file,
    })),
  )
  const first = list[0]
  const rel = first?.webkitRelativePath?.split(/[/\\]/)[0]
  return { label: rel || `${list.length} files`, count: tracks.length }
}

export async function restoreMusicFolder(path: string): Promise<number> {
  if (tracks.length) return tracks.length
  if (canPickNativeMusicFolder() && isNativeMusicUri(path)) {
    try {
      applyNativeFolder(await listNativeMusicFolder(path))
    } catch {
      return tracks.length
    }
    return tracks.length
  }
  if (window.dualSlotDesktop && path) {
    await window.dualSlotDesktop.setMusicFolder(path)
    setTracks(await collectFromElectron(path))
    return tracks.length
  }
  const handle = await loadDirHandle()
  if (!handle) return tracks.length
  const perm = (await (handle as DirectoryHandle).queryPermission?.({ mode: 'read' })) ?? 'granted'
  if (perm !== 'granted') return tracks.length
  const next: Track[] = []
  await collectFromDirectory(handle, 0, next)
  setTracks(next)
  return tracks.length
}

export async function requestStoredFolderAccess(): Promise<number> {
  const handle = await loadDirHandle()
  if (!handle) return 0
  const perm = (await (handle as DirectoryHandle).requestPermission?.({ mode: 'read' })) ?? 'denied'
  if (perm !== 'granted') return 0
  const next: Track[] = []
  await collectFromDirectory(handle, 0, next)
  setTracks(next)
  return tracks.length
}
