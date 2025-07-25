import { Writable } from 'node:stream'
import console, { Console } from 'node:console'
import { DbClient } from '@based/db'
import { sendToFunctionLogs } from './log.js'
import { createRequire } from 'node:module'

export const initDynamicFunctionsGlobals = (statsDb: DbClient) => {
  class FnGlobals {
    constructor(name: string, checksum: number) {
      this.require = createRequire(import.meta.url)
      this.name = name
      this.checksum = checksum
      this.console =
        process.env.NODE_ENV === 'test'
          ? console
          : new Console({
              stdout: new Writable({
                write(chunk, _encoding, callback) {
                  sendToFunctionLogs(
                    statsDb,
                    name,
                    checksum,
                    chunk.toString(),
                    'info',
                  )
                  callback()
                },
              }),
              stderr: new Writable({
                write(chunk, _encoding, callback) {
                  sendToFunctionLogs(
                    statsDb,
                    name,
                    checksum,
                    chunk.toString(),
                    'error',
                  )
                  callback()
                },
              }),
            })
    }

    private async initId() {
      const name = this.name
      const fnNode = await statsDb
        .query('function', { name })
        .include('id')
        .get()
        .toObject()
      if (fnNode) {
        return fnNode.id
      }
      return statsDb.create('function', { name })
    }

    private removed: true
    private name: string
    private checksum: number
    private async catcher(p: any, fn: Function) {
      try {
        await fn(p)
      } catch (e) {
        sendToFunctionLogs(
          statsDb,
          this.name,
          Number(this.checksum),
          e,
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

  global._FnGlobals = FnGlobals
}
