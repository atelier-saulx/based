import { BasedDb } from '@based/db'
import { tmpdir } from 'os'
import { join } from 'path'

type Opts = {
  name: string
  fn: (db: BasedDb) => Promise<DOMHighResTimeStamp>
}
const benchmarks: Opts[] = []
let inProgress = false

export const benchmark = async (name: Opts['name'], fn: Opts['fn']) => {
  benchmarks.push({
    name,
    fn,
  })
  if (!inProgress) {
    inProgress = true
    while (true) {
      const queued = benchmarks.shift()
      if (!queued) {
        inProgress = false
        break
      }
      const { name, fn } = queued
      const db = new BasedDb({
        path: join(tmpdir(), Math.random().toString(36).substring(2)),
      })

      await db.start({ clean: true })
      const time: DOMHighResTimeStamp = await fn(db)
      await db.destroy()
      console.log({ name, time })
    }
  }
}
