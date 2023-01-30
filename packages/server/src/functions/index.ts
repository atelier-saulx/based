import type { BasedServer } from '../server'
import {
  BasedRoute,
  BasedSpec,
  FunctionConfig,
  isQueryFunctionSpec,
  isStreamFunctionSpec,
  isQueryFunctionRoute,
} from './types'
import { deepMerge, deepEqual } from '@saulx/utils'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout'
import { destroyObs, start } from '../observable'
export * from './types'

export class BasedFunctions {
  server: BasedServer

  reqId: number = 0

  config: FunctionConfig

  unregisterTimeout: NodeJS.Timeout

  installsInProgress: { [name: string]: Promise<any> } = {}

  maxPayLoadSizeDefaults: {
    stream: number
    query: number
    function: number
  } = {
    stream: 5e6,
    query: 2500,
    function: 20e3,
  }

  paths: {
    [path: string]: string
  } = {}

  specs: {
    [name: string]: BasedSpec & {
      maxPayloadSize: number
      rateLimitTokens: number
    }
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
      for (const name in this.specs) {
        const spec = this.specs[name]
        if (isQueryFunctionSpec(spec) && this.server.activeObservables[name]) {
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

    this.uninstallLoop()
  }

  async updateFunction(spec: BasedSpec) {
    const { name } = spec
    const prevSpec = this.specs[name]
    if (prevSpec) {
      if (prevSpec.function !== spec.function) {
        if (this.beingUninstalled[name]) {
          delete this.beingUninstalled[name]
        }
        updateTimeoutCounter(spec)
        await this.installGaurdedFromConfig(name)
        await this.config.uninstall({
          server: this.server,
          function: prevSpec,
          name,
        })
        this.update(spec)
      } else {
        this.update(spec)
      }
    } else {
      this.update(spec)
    }
  }

  private async installGaurdedFromConfig(
    name: string
  ): Promise<BasedSpec | false> {
    if (this.installsInProgress[name]) {
      return this.installsInProgress[name]
    }
    this.installsInProgress[name] = this.config.install({
      server: this.server,
      name,
    })
    const s = await this.installsInProgress[name]
    delete this.installsInProgress[name]
    return s
  }

  async install(name: string): Promise<BasedSpec | false> {
    let spec = this.getFromStore(name)

    if (spec) {
      return spec
    }

    spec = await this.installGaurdedFromConfig(name)

    if (spec) {
      this.update(spec)
      return this.getFromStore(name)
    }
    return false
  }

  getNameFromPath(path: string): string {
    return this.paths[path]
  }

  route(name?: string, path?: string): BasedRoute | false {
    return this.config.route({ server: this.server, name, path })
  }

  getFromStore(name: string): BasedSpec | false {
    const spec = this.specs[name]
    if (spec) {
      if (this.beingUninstalled[name]) {
        delete this.beingUninstalled[name]
      }
      updateTimeoutCounter(spec)
      return spec
    }
    return false
  }

  update(spec: BasedSpec): boolean {
    if (!spec) {
      return false
    }

    // Case when functions are installed exactly at the same time
    if (deepEqual(spec, this.specs[spec.name])) {
      return false
    }

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

    if (!spec.maxPayloadSize) {
      if (isQueryFunctionSpec(spec)) {
        spec.maxPayloadSize = this.maxPayLoadSizeDefaults.query
      } else if (isStreamFunctionSpec(spec)) {
        spec.maxPayloadSize = this.maxPayLoadSizeDefaults.stream
      } else {
        spec.maxPayloadSize = this.maxPayLoadSizeDefaults.function
      }
    }

    if (!spec.rateLimitTokens) {
      spec.rateLimitTokens = 1
    }

    const previousChecksum = this.specs[spec.name]?.checksum ?? -1

    // @ts-ignore maxpayload and rlimit tokens added on line 184...
    this.specs[spec.name] = spec

    if (this.specs[spec.name] && this.server.activeObservables[spec.name]) {
      if (!isQueryFunctionSpec(spec)) {
        for (const [id] of this.server.activeObservables[spec.name]) {
          destroyObs(this.server, id)
        }
      } else {
        if (previousChecksum !== spec.checksum) {
          for (const [id] of this.server.activeObservables[spec.name]) {
            start(this.server, id)
          }
        }
      }
    }

    return true
  }

  remove(name: string): boolean {
    const spec = this.specs[name]
    if (!spec) {
      return false
    }
    if (isQueryFunctionRoute(spec)) {
      const activeObs = this.server.activeObservables[name]
      if (activeObs) {
        for (const [id] of activeObs) {
          destroyObs(this.server, id)
        }
        delete this.server.activeObservables[name]
      }
    }
    delete this.specs[name]
    return true
  }

  async uninstall(name: string, spec?: BasedSpec | false): Promise<boolean> {
    if (this.beingUninstalled[name]) {
      console.error('Allready being unregistered...', name)
    }
    if (!spec && spec !== false) {
      spec = this.specs[name]
    }
    if (!spec) {
      return false
    }

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

    return false
  }
}
