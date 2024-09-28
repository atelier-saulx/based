import fs from 'node:fs/promises'
import { BasedDb } from './index.js'

export const destroy = async (db: BasedDb) => {
  db.modifyCtx.len = 0
  // make stop
  await db.stop(true)
  const path = db.fileSystemPath
  try {
    await fs.rm(path, { recursive: true })
  } catch (err) {
    console.warn('Error removing dump folder', err.message)
  }
}
