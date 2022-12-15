import type { BasedServer } from '../server'
import {
  BasedFunctionSpec,
  BasedObservableFunctionSpec,
  FunctionConfig,
} from './types'
import { BasedFunctionRoute } from '../../types'
import { deepMerge } from '@saulx/utils'
import { fnIsTimedOut, extendTimeoutCounter } from './timeout'
import { removeFunction, updateFunction } from '../worker'
export * from './types'

export class BasedFunctions {
  server: BasedServer

  reqId: number = 0

  config: FunctionConfig

  unregisterTimeout: NodeJS.Timeout

  paths: {
    [path: string]: string
  } = {}

  specs: {
    [name: string]: BasedFunctionSpec | BasedObservableFunctionSpec
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
    // TODO: gets updates from worker once in a while
    this.unregisterTimeout = setTimeout(async () => {
      const q = []
      for (const name in this.specs) {
        const spec = this.specs[name]
        if (fnIsTimedOut(spec)) {
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
    if (this.unregisterTimeout) {
      clearTimeout(this.unregisterTimeout)
    }
    this.uninstallLoop()
  }

  extendTimeoutCounter(spec: BasedObservableFunctionSpec | BasedFunctionSpec) {
    // for external
    return extendTimeoutCounter(spec)
  }

  async updateFunction(spec: BasedObservableFunctionSpec | BasedFunctionSpec) {
    const { name } = spec
    const prevSpec = this.specs[name]
    if (prevSpec) {
      if (prevSpec.functionPath !== spec.functionPath) {
        if (this.beingUninstalled[name]) {
          delete this.beingUninstalled[name]
        }
        extendTimeoutCounter(spec)
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
    const spec = this.specs[name]
    if (spec) {
      if (this.beingUninstalled[name]) {
        delete this.beingUninstalled[name]
      }
      extendTimeoutCounter(spec)
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

      updateFunction(this.server, spec)

      this.specs[spec.name] = spec
    }

    return false
  }

  remove(name: string): boolean {
    if (this.specs[name]) {
      removeFunction(this.server, name)
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
      spec = this.specs[name]
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
