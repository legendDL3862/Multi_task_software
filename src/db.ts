import Dexie, { type EntityTable } from 'dexie'
import { uid } from './lib/id'
import type { DailyLog, Folder, Item, Note, Session, Settings } from './types'

export class DualSlotDB extends Dexie {
  folders!: EntityTable<Folder, 'id'>
  items!: EntityTable<Item, 'id'>
  sessions!: EntityTable<Session, 'id'>
  notes!: EntityTable<Note, 'id'>
  dailyLogs!: EntityTable<DailyLog, 'date'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('dual-slot')
    this.version(1).stores({
      folders: 'id, parentId, createdAt',
      items: 'id, lane, folderId, weight, createdAt, updatedAt, completedAt, future, buried',
      sessions: 'id, itemId, startedAt',
      notes: 'id, linkedItemId, updatedAt',
      dailyLogs: 'date',
      settings: 'id',
    })
    this.version(2).stores({
      folders: 'id, parentId, createdAt',
      items: 'id, lane, folderId, sortOrder, createdAt, updatedAt, completedAt, buried',
      sessions: 'id, itemId, startedAt, dateKey, slot',
      notes: 'id, linkedItemId, updatedAt',
      dailyLogs: 'date',
      settings: 'id',
    })
    this.on('populate', (trans) => {
      const now = Date.now()
      const names = ['未分类', '资料', '想法', '项目']
      trans.table('folders').bulkAdd(
        names.map((name, i) => ({
          id: uid(),
          name,
          parentId: null,
          createdAt: now + i,
        })),
      )
    })
  }
}

export const db = new DualSlotDB()
