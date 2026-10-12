/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface DualSlotDesktop {
  pickMusicFolder: () => Promise<string | null>
  setMusicFolder: (dir: string) => Promise<string>
  listMusic: (dir: string) => Promise<{ name: string; path: string }[]>
  readMusic: (filePath: string) => Promise<ArrayBuffer>
}

interface Window {
  dualSlotDesktop?: DualSlotDesktop
  showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>
}
