export type Lane = 'lot' | 'primary' | 'secondary' | 'archive'
export type NoiseType = 'off' | 'white' | 'pink' | 'brown'
export type Scene = 'dusk' | 'paper' | 'forest' | 'night' | 'sand'
export type Locale = 'zh' | 'en'
export type TimerMode = 'countup' | 'countdown'
export type Slot = 'primary' | 'secondary' | 'other' | 'habit'
export type MusicSource = NoiseType | 'folder'
export type AlarmType = 'off' | 'chime' | 'bell' | 'wood'
export type PlayMode = 'sequence' | 'loop' | 'shuffle'

export type Folder = {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

export type Habit = {
  id: string
  title: string
  content: string
  tags: string[]
  dailyMinMinutes: number
  sortOrder: number
  archived: boolean
  totalSeconds: number
  sessionCount: number
  createdAt: number
  updatedAt: number
}

export type Item = {
  id: string
  title: string
  content: string
  tags: string[]
  lane: Lane
  folderId: string | null
  sortOrder: number
  reflux: boolean
  buried: boolean
  totalSeconds: number
  sessionCount: number
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

export type Session = {
  id: string
  itemId: string
  slot: Slot
  dateKey: string
  mode: TimerMode
  plannedSeconds: number
  elapsedSeconds: number
  startedAt: number
  endedAt: number | null
  captures: string[]
}

export type Note = {
  id: string
  body: string
  linkedItemId: string | null
  createdAt: number
  updatedAt: number
}

export type DailyLog = {
  date: string
  content: string
  updatedAt: number
}

export type TimerState = {
  itemId: string
  sessionId: string
  slot: Slot
  mode: TimerMode
  plannedSeconds: number
  elapsedSeconds: number
  remainingSeconds: number
  running: boolean
} | null

export type Settings = {
  id: 'settings'
  noiseType: MusicSource
  noiseVolume: number
  defaultMinutes: number
  locale: Locale
  scene: Scene
  timerMode: TimerMode
  primaryMinMinutes: number
  secondaryMinMinutes: number
  musicFolderLabel: string
  musicFolderPath: string
  alarmType: AlarmType
  alarmVolume: number
  musicPlayMode: PlayMode
  liveTimer: (Exclude<TimerState, null> & { savedAt: number }) | null
}

export type BackupPayload = {
  version: 1 | 2 | 3
  exportedAt: number
  folders: Folder[]
  items: Item[]
  sessions: Session[]
  notes: Note[]
  dailyLogs: DailyLog[]
  habits?: Habit[]
  settings: Settings
}

export type CompletionState = {
  itemId: string
  title: string
} | null
