import type { BasedServer } from '../server'
import {
  BasedFunctionRoute,
  BasedFunctionSpec,
  BasedObservableFunctionSpec,
  FunctionConfig,
  isObservableFunctionSpec,
} from '../types'
import { deepMerge } from '@saulx/utils'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout'
import { destroy, initFunction } from '../observable'
import { Worker } from 'node:worker_threads'
import { join } from 'path'

/*
  isMainThread,
  parentPort,
  workerData,
*/

export { isObservableFunctionSpec }

const WORKER_PATH = join(__dirname, './worker')

export class BasedFunctions {
  server: BasedServer

  config: FunctionConfig

  unregisterTimeout: NodeJS.Timeout

  workers: Worker[] = []

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

    if (d !== 0) {
      if (d < 0) {
        for (let i = 0; i < d; i++) {
          const worker = this.workers.pop()
          worker.terminate()
        }
      } else {
        for (let i = 0; i < d; i++) {
          this.workers.push(new Worker(WORKER_PATH, {}))
        }
      }
    }

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
      return true
    } else if (this.functions[name]) {
      if (this.functions[name].path) {
        delete this.paths[this.functions[name].path]
      }
      delete this.functions[name]
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

  // time to add a core client in a worker?

  // selva needs to be avaible trough a worker adress / id

  // just add sharedBuffer to send back and call things from the server

  // has to call it in the worker
  async stopObservableFunction(name: string) {}

  async runObservableFunction(spec: BasedObservableFunctionSpec) {}

  async runFunction(spec: BasedFunctionSpec) {
    // start with this
  }
}
