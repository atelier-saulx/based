import { Writable } from 'node:stream'
import { Console } from 'node:console'
import { DbClient } from '@based/db'
import { createEvent } from './event.js'
import { createRequire } from 'node:module'

export const initDynamicFunctionsGlobals = (statsDb: DbClient) => {
  class FnGlobals {
    constructor(name: string, checksum: number) {
      this.require = createRequire(import.meta.url)
      this.name = name
      this.checksum = checksum
      this.console = new Console({
        stdout: new Writable({
          write(chunk, _encoding, callback) {
            createEvent(
              statsDb,
              name,
              checksum,
              chunk.toString(),
              'runtime',
              'info',
            )
            callback()
          },
        }),
        stderr: new Writable({
          write(chunk, _encoding, callback) {
            createEvent(
              statsDb,
              name,
              checksum,
              chunk.toString(),
              'runtime',
              'error',
            )
            callback()
          },
        }),
      })
    }

    private removed: true
    private name: string
    private checksum: number
    private async catcher(p: any, fn: Function) {
      try {
        await fn(p)
      } catch (e) {
        createEvent(
          statsDb,
          this.name,
          Number(this.checksum),
          e.message,
          'runtime',
          'error',
        )
      }
    }
    private timers = new Set()
    private intervals = new Set()
    public console: Console
    public require: NodeRequire
    public setImmediate = <T extends Function, A>(fn: T, arg?: A) => {
      if (this.removed) {
        return
      }
      return setImmediate((p) => this.catcher(p, fn), arg)
    }

    public setTimeout = <T extends Function>(fn: T, t: number = 0) => {
      if (this.removed) {
        return
      }
      const id = setTimeout((p) => {
        this.timers.delete(id)
        return this.catcher(p, fn)
      }, t)
      this.timers.add(id)
      return id
    }

    public setInterval = <T extends Function>(fn: T, t: number = 0) => {
      if (this.removed) {
        return
      }
      const id = setInterval((p) => {
        this.catcher(p, fn)
      }, t)
      this.intervals.add(id)
      return id
    }

    public clearTimeout = (id) => {
      if (this.removed) {
        return
      }
      this.timers.delete(id)
      return clearTimeout(id)
    }

    public clearInterval = (id) => {
      if (this.removed) {
        return
      }
      this.intervals.delete(id)
      return clearInterval(id)
    }

    public clear() {
      if (this.removed) return
      this.timers.forEach(global.clearTimeout)
      this.intervals.forEach(global.clearInterval)
      delete this.timers
      delete this.intervals
      this.removed = true
    }
  }

  // add activer functions handlers use this with id etc for fns

  global._FnGlobals = FnGlobals
}
