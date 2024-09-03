import fs from 'node:fs/promises'
import { BasedDb } from './index.js'

export const destroy = async (db: BasedDb) => {
  // make stop
  await db.stop()
  const path = db.fileSystemPath
  try {
    await fs.rm(path, { recursive: true })
  } catch (err) {
    console.warn('Error removing dump folder', err.message)
  }
}
