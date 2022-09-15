import type { BasedServer } from '../server'
import {
  BasedFunctionSpec,
  BasedObservableFunctionSpec,
  FunctionConfig,
  isObservableFunctionSpec,
} from '../types'
import { deepMerge } from '@saulx/utils'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout'
import { destroy, initFunction } from '../observable'

export { isObservableFunctionSpec }

export class BasedFunctions {
  server: BasedServer

  config: FunctionConfig

  unregisterTimeout: NodeJS.Timeout

  paths: {
    [path: string]: string
  } = {}

  observables: {
    [name: string]: BasedObservableFunctionSpec
  } = {}

  functions: {
    [name: string]: BasedFunctionSpec
  } = {}

  beingUnregisterd: {
    [name: string]: boolean
  } = {}

  constructor(server: BasedServer, config?: FunctionConfig) {
    this.server = server
    if (config) {
      this.updateConfig(config)
    }
  }

  unregisterLoop() {
    this.unregisterTimeout = setTimeout(async () => {
      const q = []
      for (const name in this.functions) {
        const spec = this.functions[name]
        if (fnIsTimedOut(spec)) {
          q.push(this.unregister(name, spec))
        }
      }
      for (const name in this.observables) {
        const spec = this.observables[name]
        if (this.server.activeObservables[name]) {
          updateTimeoutCounter(spec)
        } else if (fnIsTimedOut(spec)) {
          q.push(this.unregister(name, spec))
        }
      }
      await Promise.all(q)
      this.unregisterLoop()
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
      this.config.maxWorkers = 0
    }
    if (this.config.log === undefined) {
      this.config.log = (opts) => {
        console.info(opts)
      }
    }
    if (this.unregisterTimeout) {
      clearTimeout(this.unregisterTimeout)
    }
    this.unregisterLoop()
  }

  async get(
    name: string
  ): Promise<BasedObservableFunctionSpec | BasedFunctionSpec | false> {
    let spec = this.getFromStore(name)
    if (spec) {
      return spec
    }

    spec = await this.config.register({
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

  async getByPath(
    path: string
  ): Promise<BasedObservableFunctionSpec | BasedFunctionSpec | false> {
    if (!this.config.registerByPath) {
      return false
    }
    const name = this.getNameFromPath(path)
    if (name) {
      return this.get(name)
    } else {
      const spec = await this.config.registerByPath({
        server: this.server,
        path,
      })
      if (spec) {
        this.update(spec)
        return this.getFromStore(spec.name)
      }
      return false
    }
  }

  getFromStore(
    name: string
  ): BasedObservableFunctionSpec | BasedFunctionSpec | false {
    const spec = this.observables[name] || this.functions[name]
    if (spec) {
      if (this.beingUnregisterd[name]) {
        console.info('getFromStore is being unreg', name)

        delete this.beingUnregisterd[name]
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

  async unregister(
    name: string,
    spec?: BasedObservableFunctionSpec | BasedFunctionSpec | false
  ): Promise<boolean> {
    if (this.beingUnregisterd[name]) {
      console.error('Allready being unregistered...', name)
    }
    if (!spec && spec !== false) {
      spec = this.getFromStore(name)
    }
    if (spec) {
      this.beingUnregisterd[name] = true
      if (
        await this.config.unregister({
          server: this.server,
          function: spec,
          name,
        })
      ) {
        if (this.beingUnregisterd[name]) {
          delete this.beingUnregisterd[name]
          return this.remove(name)
        } else {
          console.info('got requested while being unregistered', name)
        }
      }
    }
    return false
  }
}
