import { fork } from 'node:child_process'
import { parentPort, Worker, workerData } from 'node:worker_threads'
import { DbServer } from '../../src/db.js'
import { fileURLToPath } from 'node:url'
import { DbShared } from '../../src/shared/DbBase.js'
import { Emitter } from '../../src/shared/Emitter.js'

const lazyParse = (val: any) => {
  if (typeof val === 'object' && val !== null) {
    if (val[0] && !Array.isArray(val) && typeof val[0] === 'number') {
      // its a uint8array
      return Uint8Array.from(Object.values(val))
    }
    for (const i in val) {
      val[i] = lazyParse(val[i])
    }
  }
  return val
}

export const serverChildProcess = (path: string): DbServer => {
  const p = new Worker(fileURLToPath(import.meta.url), {
    workerData: {
      CHILD_PATH: path,
    },
  })

  const shim: Partial<DbServer> = {}
  const props = {
    ...Object.getOwnPropertyDescriptors(Emitter.prototype),
    ...Object.getOwnPropertyDescriptors(DbShared.prototype),
    ...Object.getOwnPropertyDescriptors(DbServer.prototype),
  }
  const listeners = new Map()
  const queue = new Map()
  let cnt = 0

  for (const prop in props) {
    if (typeof props[prop].value === 'function') {
      shim[prop] = (...args) =>
        new Promise((resolve) => {
          let id = cnt++
          if (typeof args.at(-1) === 'function') {
            const listener = args.at(-1)
            listeners.set(id, (res) => listener(...res))
            args[args.length - 1] = 'LISTENER'
            id = cnt++
          }
          queue.set(id, resolve)
          p.postMessage([id, prop, ...args])
        })
    }
  }

  p.on('message', ([id, res]: any) => {
    res = lazyParse(res)
    const resolve = queue.get(id)
    const listener = listeners.get(id)
    if (resolve) {
      resolve(res)
      queue.delete(id)
    }
    if (listener) {
      listener(res)
    }
  })

  return shim as DbServer
}

if (process.env.CHILD_PATH) {
  const server = new DbServer({
    path: process.env.CHILD_PATH,
  })

  process.on('message', async ([id, cmd, ...args]: any) => {
    args = lazyParse(args)
    if (args.at(-1) === 'LISTENER') {
      args[args.length - 1] = (...res) => {
        process.send!([id - 1, res])
      }
    }
    const res = await server[cmd](...args)
    process.send!([id, res])

    if (cmd === 'destroy') {
      process.exit()
    }
  })
} else if (workerData?.CHILD_PATH) {
  const p = fork(fileURLToPath(import.meta.url), {
    env: {
      CHILD_PATH: workerData.CHILD_PATH,
    },
  })
  p.on('message', (msg) => parentPort!.postMessage(msg))
  p.on('exit', () => process.exit())
  parentPort!.on('message', (msg) => p.send(msg))
}
