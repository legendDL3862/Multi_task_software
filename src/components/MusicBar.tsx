import { useEffect, useRef } from 'react'
import { useI18n } from '../hooks/useI18n'
import { useMusic } from '../hooks/useMusic'
import {
  ingestMusicFiles,
  pauseMusic,
  pickMusicFolder,
  playMusic,
  requestStoredFolderAccess,
  restoreMusicFolder,
  seekMusic,
  setMusicSource,
  setMusicVolume,
  skipSeconds,
  setPlayMode,
  skipTrack,
  supportsDirectoryPicker,
} from '../lib/music'
import { useAppStore } from '../store/useAppStore'
import type { MusicSource, PlayMode } from '../types'

const PLAY_MODES: PlayMode[] = ['sequence', 'loop', 'shuffle']

const SOURCES: MusicSource[] = ['off', 'white', 'pink', 'brown', 'folder']

function PlayModeIcon({ mode }: { mode: PlayMode }) {
  if (mode === 'shuffle') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m16 3 4 4-4 4" />
        <path d="M4 7h4l8 10h4" />
        <path d="m16 21 4-4" />
        <path d="M4 17h4l1.8-2.2" />
      </svg>
    )
  }
  if (mode === 'loop') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        <path d="M12 9.2v5.6" />
        <path d="M10.6 10.6 12 9.2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function MusicBar() {
  const t = useI18n()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const setToast = useAppStore((s) => s.setToast)
  const player = useMusic()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void restoreMusicFolder(settings.musicFolderPath)
  }, [settings.musicFolderPath])

  useEffect(() => {
    setMusicSource(settings.noiseType)
  }, [settings.noiseType])

  useEffect(() => {
    setMusicVolume(settings.noiseVolume)
  }, [settings.noiseVolume])

  useEffect(() => {
    setPlayMode(settings.musicPlayMode)
  }, [settings.musicPlayMode])

  const labels: Record<MusicSource, string> = {
    off: t.noiseOff,
    white: t.noiseWhite,
    pink: t.noisePink,
    brown: t.noiseBrown,
    folder: t.noiseFolder,
  }

  async function chooseFolder() {
    try {
      const picked = await pickMusicFolder()
      if (!picked) return
      await patchSettings({
        noiseType: 'folder',
        musicFolderLabel: picked.label,
        musicFolderPath: picked.path,
      })
      if (!picked.count) setToast(t.folderEmpty)
    } catch {
      /* cancelled */
    }
  }

  async function reauthFolder() {
    const count = await requestStoredFolderAccess()
    if (!count) setToast(t.folderEmpty)
  }

  const folder = settings.noiseType === 'folder'
  const canPlay = settings.noiseType !== 'off' && (!folder || player.count > 0)

  return (
    <div className="border-t border-line px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <select
          className="min-w-0 flex-1 rounded-full border border-line bg-card px-3 py-1.5 text-ink"
          value={settings.noiseType}
          onChange={(e) => void patchSettings({ noiseType: e.target.value as MusicSource })}
        >
          {SOURCES.map((n) => (
            <option key={n} value={n}>
              {labels[n]}
            </option>
          ))}
        </select>
        {settings.noiseType !== 'off' ? (
          <label className="flex w-20 items-center gap-1 text-muted">
            {Math.round(settings.noiseVolume * 100)}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.noiseVolume}
              onChange={(e) => void patchSettings({ noiseVolume: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        ) : null}
      </div>

      {settings.noiseType !== 'off' ? (
        <div className="mt-1.5 flex items-center justify-center gap-2">
          {folder ? (
            <>
              <button type="button" className="rounded-full border border-line px-2 py-1" onClick={() => void skipTrack(-1)}>
                {t.prevTrack}
              </button>
              <button type="button" className="rounded-full border border-line px-2 py-1" onClick={() => skipSeconds(-10)}>
                {t.skipBack}
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={!canPlay}
            className="rounded-full bg-sage px-4 py-1 text-paper disabled:opacity-40"
            onClick={() =>
              player.playing ? pauseMusic() : void playMusic(settings.noiseType)
            }
          >
            {player.playing ? t.pause : t.playMusic}
          </button>
          {folder ? (
            <>
              <button type="button" className="rounded-full border border-line px-2 py-1" onClick={() => skipSeconds(10)}>
                {t.skipFwd}
              </button>
              <button type="button" className="rounded-full border border-line px-2 py-1" onClick={() => void skipTrack(1)}>
                {t.nextTrack}
              </button>
              <button
                type="button"
                title={
                  settings.musicPlayMode === 'sequence'
                    ? t.playSequence
                    : settings.musicPlayMode === 'loop'
                      ? t.playLoop
                      : t.playShuffle
                }
                aria-label={
                  settings.musicPlayMode === 'sequence'
                    ? t.playSequence
                    : settings.musicPlayMode === 'loop'
                      ? t.playLoop
                      : t.playShuffle
                }
                className="rounded-full border border-line px-2 py-1"
                onClick={() => {
                  const i = PLAY_MODES.indexOf(settings.musicPlayMode)
                  void patchSettings({ musicPlayMode: PLAY_MODES[(i + 1) % PLAY_MODES.length] })
                }}
              >
                <PlayModeIcon mode={settings.musicPlayMode} />
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {folder ? (
        <div className="mt-1.5 space-y-1 text-muted">
          <p className="truncate">
            {player.trackName ?? settings.musicFolderLabel ?? t.nowPlaying}
            {player.count ? ` · ${player.index + 1}/${player.count}` : ''}
          </p>
          <label className="flex items-center gap-2">
            <span className="w-8 tabular-nums">{clock(player.current)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, player.duration)}
              step={0.1}
              value={Math.min(player.current, player.duration || 0)}
              onChange={(e) => seekMusic(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 tabular-nums">{clock(player.duration)}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {supportsDirectoryPicker() ? (
              <button type="button" className="rounded-full border border-line px-3 py-1" onClick={() => void chooseFolder()}>
                {t.pickFolder}
              </button>
            ) : (
              <button type="button" className="rounded-full border border-line px-3 py-1" onClick={() => fileRef.current?.click()}>
                {t.pickFolder}
              </button>
            )}
            {!window.dualSlotDesktop && settings.musicFolderLabel && player.count === 0 ? (
              <button type="button" className="rounded-full border border-line px-3 py-1" onClick={() => void reauthFolder()}>
                {t.reauthFolder}
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (!e.target.files?.length) return
              const result = ingestMusicFiles(e.target.files)
              void patchSettings({
                noiseType: 'folder',
                musicFolderLabel: result.label,
                musicFolderPath: '',
              })
              if (!result.count) setToast(t.folderEmpty)
              e.target.value = ''
            }}
            {...{ webkitdirectory: '' }}
          />
        </div>
      ) : null}
    </div>
  )
}
