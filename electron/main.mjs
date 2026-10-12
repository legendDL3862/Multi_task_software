import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const AUDIO = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i
const MAX_TRACKS = 300
const MAX_DEPTH = 3
let allowedRoot = ''

function assertAllowed(filePath) {
  const resolved = path.resolve(filePath)
  const root = path.resolve(allowedRoot)
  if (!root) throw new Error('no folder')
  const prefix = root.endsWith(path.sep) ? root : root + path.sep
  if (resolved !== root && !resolved.startsWith(prefix)) throw new Error('denied')
  return resolved
}

async function walk(folder, depth, acc) {
  if (depth > MAX_DEPTH || acc.length >= MAX_TRACKS) return
  let entries
  try {
    entries = await fs.readdir(folder, { withFileTypes: true })
  } catch {
    return
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  for (const ent of entries) {
    if (acc.length >= MAX_TRACKS) break
    const next = path.join(folder, ent.name)
    if (ent.isDirectory()) await walk(next, depth + 1, acc)
    else if (AUDIO.test(ent.name)) acc.push({ name: ent.name, path: next })
  }
}

ipcMain.handle('music:pickFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  allowedRoot = result.filePaths[0]
  return allowedRoot
})

ipcMain.handle('music:setFolder', async (_event, folder) => {
  const resolved = path.resolve(String(folder))
  const stat = await fs.stat(resolved)
  if (!stat.isDirectory()) throw new Error('not a directory')
  allowedRoot = resolved
  return allowedRoot
})

ipcMain.handle('music:list', async (_event, folder) => {
  const root = assertAllowed(String(folder))
  const acc = []
  await walk(root, 0, acc)
  return acc
})

ipcMain.handle('music:read', async (_event, filePath) => {
  const resolved = assertAllowed(String(filePath))
  const buf = await fs.readFile(resolved)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
})

function createWindow() {
  const win = new BrowserWindow({
    width: 448,
    height: 900,
    minWidth: 380,
    minHeight: 640,
    autoHideMenuBar: true,
    title: '双槽',
    webPreferences: {
      preload: path.join(dir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  void win.loadFile(path.join(dir, '../dist/index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
