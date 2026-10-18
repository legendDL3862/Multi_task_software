import { Capacitor, registerPlugin } from '@capacitor/core'

type NativeTrack = { name: string; uri: string }
export type NativeFolder = { uri: string; label: string; files: NativeTrack[] }

type MusicFolderPlugin = {
  pickFolder: () => Promise<NativeFolder>
  listFolder: (options: { uri: string }) => Promise<NativeFolder>
  readFile: (options: { uri: string }) => Promise<{ path: string; base64?: string }>
}

const MusicFolder = registerPlugin<MusicFolderPlugin>('MusicFolder')

export function canPickNativeMusicFolder() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export function isNativeMusicUri(path: string) {
  return path.startsWith('content:')
}

export async function pickNativeMusicFolder() {
  return MusicFolder.pickFolder()
}

export async function listNativeMusicFolder(uri: string) {
  return MusicFolder.listFolder({ uri })
}

export async function loadNativeMusicFile(uri: string) {
  const { path, base64 } = await MusicFolder.readFile({ uri })
  if (base64) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mimeOf(uri) })
  }
  const src = Capacitor.convertFileSrc(path.startsWith('file:') ? path : `file://${path}`)
  try {
    const res = await fetch(src)
    if (!res.ok) throw new Error('unreadable')
    const blob = await res.blob()
    if (!blob.size) throw new Error('empty')
    const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : mimeOf(uri)
    return new Blob([blob], { type: mime })
  } catch {
    return src
  }
}

function mimeOf(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.m4a') || lower.endsWith('.aac')) return 'audio/mp4'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.ogg') || lower.endsWith('.oga') || lower.endsWith('.opus')) return 'audio/ogg'
  if (lower.endsWith('.flac')) return 'audio/flac'
  if (lower.endsWith('.webm')) return 'audio/webm'
  return 'audio/mpeg'
}
