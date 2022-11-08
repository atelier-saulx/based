import type { BasedServer } from '../server'
import {
  BasedFunctionRoute,
  BasedFunctionSpec,
  BasedObservableFunctionSpec,
  FunctionConfig,
  isObservableFunctionSpec,
  BasedWorker,
} from '../types'
import { deepMerge } from '@saulx/utils'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout'
import { destroy, initFunction } from '../observable'
import { Worker } from 'node:worker_threads'
import { join } from 'path'
import { workerMessage } from '../network/worker'

export { isObservableFunctionSpec }

const WORKER_PATH = join(__dirname, '../worker')

export class BasedFunctions {
  server: BasedServer

  reqId: number = 0

  config: FunctionConfig

  unregisterTimeout: NodeJS.Timeout

  workers: BasedWorker[] = []

  workerResponseListeners: Map<number, (err: Error, p: any) => void> = new Map()

  paths: {
    [path: string]: string
  } = {}

  observables: {
    [name: string]: BasedObservableFunctionSpec
  } = {}

  functions: {
    [name: string]: BasedFunctionSpec
  } = {}

  beingUninstalled: {
    [name: string]: boolean
  } = {}

  lowestWorker: BasedWorker

  constructor(server: BasedServer, config?: FunctionConfig) {
    this.server = server
    if (config) {
      this.updateConfig(config)
    }
  }

  uninstallLoop() {
    this.unregisterTimeout = setTimeout(async () => {
      const q = []
      for (const name in this.functions) {
        const spec = this.functions[name]
        if (fnIsTimedOut(spec)) {
          q.push(this.uninstall(name, spec))
        }
      }
      for (const name in this.observables) {
        const spec = this.observables[name]
        if (this.server.activeObservables[name]) {
          updateTimeoutCounter(spec)
        } else if (fnIsTimedOut(spec)) {
          q.push(this.uninstall(name, spec))
        }
      }
      await Promise.all(q)
      this.uninstallLoop()
    }, 3e3)
  }

  updateConfig(config: FunctionConfig) {
    if (this.config) {
      deepMerge(this.config, config)
    } else {
      this.config = config
    }
    if (this.config.idleTimeout === undefined) {
      this.config.idleTimeout = 60e3 // 1 min
    }
    if (this.config.memCacheTimeout === undefined) {
      this.config.memCacheTimeout = 3e3
    }
    if (this.config.maxWorkers === undefined) {
      this.config.maxWorkers = 1
    }
    if (this.config.log === undefined) {
      this.config.log = (opts) => {
        console.info(opts)
      }
    }
    if (this.unregisterTimeout) {
      clearTimeout(this.unregisterTimeout)
    }

    const d = this.config.maxWorkers - this.workers.length

    const functionApiWrapperPath =
      this.config.functionApiWrapperPath ||
      join(__dirname, './dummyFunctionApiWrapper')

    const workerData = {
      workerData: { functionApiWrapperPath },
    }

    // clean all this stuff up.....
    if (d !== 0) {
      if (d < 0) {
        for (let i = 0; i < d; i++) {
          // active into account
          const w = this.workers.pop()
          w.worker.terminate()
        }
      } else {
        for (let i = 0; i < d; i++) {
          const worker = new Worker(WORKER_PATH, workerData)

          const basedWorker: BasedWorker = {
            worker,
            nestedObservers: new Set(),
            index: this.workers.length,
            activeObservables: 0,
            activeFunctions: 0,
          }

          this.workers.push(basedWorker)

          if (this.server.auth) {
            // allways install authorize
            worker.postMessage({
              type: 5,
              name: 'authorize', // default name for this...
              path: this.server.auth.config.authorizePath,
            })
          }

          worker.on('message', (data) => {
            workerMessage(this.server, basedWorker, data)
          })
        }
      }
    }

    if (this.workers.length === 0) {
      throw new Error('Needs at least 1 worker')
    }

    this.lowestWorker = this.workers.sort((a, b) => {
      // will be RATE LIMIT TOKEN
      return a.activeFunctions < b.activeFunctions
        ? -1
        : a.activeFunctions === b.activeFunctions
        ? 0
        : 1
    })[0]

    this.uninstallLoop()
  }

  async install(
    name: string
  ): Promise<BasedObservableFunctionSpec | BasedFunctionSpec | false> {
    let spec = this.getFromStore(name)

    if (spec) {
      return spec
    }

    spec = await this.config.install({
      server: this.server,
      name,
    })
    if (spec) {
      this.update(spec)
      return this.getFromStore(name)
    }
    return false
  }

  getNameFromPath(path: string): string {
    return this.paths[path]
  }

  route(name?: string, path?: string): BasedFunctionRoute | false {
    const result = this.config.route({ server: this.server, name, path })
    if (result && !result.maxPayloadSize) {
      if (result.observable) {
        // 50kb
        result.maxPayloadSize = 50000
      } else {
        if (result.stream) {
          result.maxPayloadSize = -1
        } else {
          result.maxPayloadSize = 250000
        }
      }
    }
    return result
  }

  getFromStore(
    name: string
  ): BasedObservableFunctionSpec | BasedFunctionSpec | false {
    const spec = this.observables[name] || this.functions[name]
    if (spec) {
      if (this.beingUninstalled[name]) {
        console.info('getFromStore is being uninstalled', name)

        delete this.beingUninstalled[name]
      }

      updateTimeoutCounter(spec)
      return spec
    }
    return false
  }

  update(spec: BasedObservableFunctionSpec | BasedFunctionSpec): boolean {
    // force uninstall in workers (and clear require cache - so it hopefully re-evaluates authorize etc)
    // will make the 'call' function to be able to call a user defined authorize

    if (spec) {
      if (!spec.idleTimeout) {
        spec.idleTimeout = this.config.idleTimeout
      }
      if (spec.timeoutCounter === undefined) {
        spec.timeoutCounter =
          spec.idleTimeout === 0 ? -1 : Math.ceil(spec.idleTimeout / 1e3)
      }

      if (spec.path) {
        this.paths[spec.path] = spec.name
      }

      if (isObservableFunctionSpec(spec)) {
        if (this.functions[spec.name]) {
          this.remove(spec.name)
        } else if (this.observables[spec.name]) {
          for (const w of this.workers) {
            w.worker.postMessage({
              type: 6,
              name: spec.name,
            })
          }
        }
        this.observables[spec.name] = spec
        if (this.server.activeObservables[spec.name]) {
          for (const [id] of this.server.activeObservables[spec.name]) {
            initFunction(this.server, id)
          }
        }
      } else {
        if (this.observables[spec.name]) {
          this.remove(spec.name)
        } else if (this.functions[spec.name]) {
          for (const w of this.workers) {
            w.worker.postMessage({
              type: 6,
              name: spec.name,
            })
          }
        }
        this.functions[spec.name] = spec
      }
    }
    return false
  }

  remove(name: string): boolean {
    // Does not call unregister!
    if (this.observables[name]) {
      if (this.observables[name].path) {
        delete this.paths[this.observables[name].path]
      }
      delete this.observables[name]
      const activeObs = this.server.activeObservables[name]
      if (activeObs) {
        for (const [id] of activeObs) {
          destroy(this.server, id)
        }
        delete this.server.activeObservables[name]
      }
      // this is a bit harder... not allways relevant
      for (const w of this.workers) {
        w.worker.postMessage({
          type: 6,
          name,
        })
      }
      return true
    } else if (this.functions[name]) {
      if (this.functions[name].path) {
        delete this.paths[this.functions[name].path]
      }
      delete this.functions[name]
      for (const w of this.workers) {
        w.worker.postMessage({
          type: 6,
          name,
        })
      }
      return true
    }

    return false
  }

  async uninstall(
    name: string,
    spec?: BasedObservableFunctionSpec | BasedFunctionSpec | false
  ): Promise<boolean> {
    if (this.beingUninstalled[name]) {
      console.error('Allready being unregistered...', name)
    }
    if (!spec && spec !== false) {
      spec = this.getFromStore(name)
    }
    if (spec) {
      this.beingUninstalled[name] = true
      if (
        await this.config.uninstall({
          server: this.server,
          function: spec,
          name,
        })
      ) {
        if (this.beingUninstalled[name]) {
          delete this.beingUninstalled[name]
          return this.remove(name)
        } else {
          console.info('got requested while being unregistered', name)
        }
      }
    }
    return false
  }

  // from other worker fn
  runObservableFunction(
    spec: BasedFunctionSpec,
    id: number,
    error: (err: Error) => void,
    update: (
      encodedDiffData: Uint8Array,
      encodedData: Uint8Array,
      checksum: number,
      isDeflate: boolean,
      reusedCache: boolean
    ) => void,
    payload?: any
  ): () => void {
    // TODO: move selection criteria etc to other file

    const selectedWorker: BasedWorker = this.lowestWorker

    this.workerResponseListeners.set(id, (err, p) => {
      if (err) {
        error(err)
      } else {
        update(p.diff, p.data, p.checksum, p.isDeflate, p.reusedCache)
      }
    })
    selectedWorker.worker.postMessage({
      type: 1,
      id,
      name: spec.name,
      path: spec.functionPath,
      payload,
    })
    return () => {
      this.workerResponseListeners.delete(id)
      selectedWorker.worker.postMessage({
        id,
        type: 2,
      })
    }
  }

  async runFunction(
    type: 0 | 3 | 4,
    // 0 is normal function WS
    // 3 is POST payload
    // 4 is GET payload
    spec: BasedFunctionSpec,
    context: { [key: string]: any }, // make this specific
    payload?: Uint8Array
  ): Promise<Uint8Array> {
    // TODO: move selection criteria etc to other file

    return new Promise((resolve, reject) => {
      const listenerId = ++this.reqId
      // max concurrent execution is 1 mil...
      if (this.workerResponseListeners.size >= 1e6) {
        throw new Error(
          'MAX CONCURRENT SERVER FUNCTION EXECUTION REACHED (1 MIL)'
        )
      }
      if (this.reqId > 1e6) {
        this.reqId = 0
      }
      const selectedWorker: BasedWorker = this.lowestWorker
      this.workerResponseListeners.set(listenerId, (err, p) => {
        this.workerResponseListeners.delete(listenerId)

        // include observables
        selectedWorker.activeFunctions--
        if (
          selectedWorker.activeFunctions < this.lowestWorker.activeFunctions
        ) {
          this.lowestWorker = selectedWorker
        }
        if (err) {
          reject(err)
        } else {
          // prob shared array buffer...
          resolve(p)
        }
      })
      selectedWorker.activeFunctions++
      let next = selectedWorker.index + 1
      if (next >= this.workers.length) {
        next = 0
      }
      if (selectedWorker.activeFunctions > this.workers[next].activeFunctions) {
        this.lowestWorker = this.workers[next]
      }
      selectedWorker.worker.postMessage({
        type,
        path: spec.functionPath,
        name: spec.name,
        payload,
        context,
        id: listenerId,
      })
      // console.info(
      //   'SPEED',
      //   selectedWorker.worker.threadId,
      //   selectedWorker.worker.performance.eventLoopUtilization()
      // )
    })
  }
}
