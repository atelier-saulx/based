import type { BasedServer } from '../server'
import {
  BasedFunctionRoute,
  BasedFunctionSpec,
  BasedObservableFunctionSpec,
  FunctionConfig,
  isObservableFunctionSpec,
  BasedWorker,
} from '../../types'
import { deepMerge } from '@saulx/utils'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout'
import { destroyObs, initFunction } from '../observable'
import { BasedError, BasedErrorCode } from '../../error'
import { sendToWorker, updateWorkers } from '../worker'
import { IncomingType } from '../../worker/types'

export class BasedFunctions {
  server: BasedServer

  reqId: number = 0

  config: FunctionConfig

  unregisterTimeout: NodeJS.Timeout

  workers: BasedWorker[] = []

  workerResponseListeners: Map<
    number,
    (err: null | BasedError, p?: any) => void
  > = new Map()

  workerObsListeners: Map<
    number,
    (
      err: null | BasedError<BasedErrorCode.ObservableFunctionError>,
      p?: any
    ) => void
  > = new Map()

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

    if (this.unregisterTimeout) {
      clearTimeout(this.unregisterTimeout)
    }

    updateWorkers(this)

    this.uninstallLoop()
  }

  async updateFunction(spec: BasedObservableFunctionSpec | BasedFunctionSpec) {
    const { name } = spec

    const prevSpec = this.observables[name] || this.functions[name]
    if (prevSpec) {
      if (prevSpec.functionPath !== spec.functionPath) {
        if (this.beingUninstalled[name]) {
          delete this.beingUninstalled[name]
        }
        updateTimeoutCounter(spec)
        await this.config.install({
          server: this.server,
          name: spec.name,
          function: spec,
        })
        await this.config.uninstall({
          server: this.server,
          function: prevSpec,
          name,
        })
        this.update(spec)
      } else {
        this.update(spec)
      }
    }
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
        } else if (this.observables[spec.name]) {
          for (const w of this.workers) {
            sendToWorker(w, {
              type: IncomingType.RemoveFunction,
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
            sendToWorker(w, {
              type: IncomingType.RemoveFunction,
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
          destroyObs(this.server, id)
        }
        delete this.server.activeObservables[name]
      }
      // this is a bit harder... not allways relevant
      for (const w of this.workers) {
        sendToWorker(w, {
          type: IncomingType.RemoveFunction,
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
        sendToWorker(w, {
          type: IncomingType.RemoveFunction,
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
      spec = this.observables[name] || this.functions[name]
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
}