import type { BasedServer } from '../server'
import {
  BasedRoute,
  BasedSpec,
  FunctionConfig,
  isQueryFunctionSpec,
  isStreamFunctionSpec,
  isQueryFunctionRoute,
  isChannelFunctionSpec,
} from './types'
import { deepMerge, deepEqual } from '@saulx/utils'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout'
import { destroyObs, start } from '../observable'
import { destroyChannel, startChannel } from '../channel'
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
    channel: number
  } = {
    stream: 5e6,
    query: 2500,
    function: 20e3,
    channel: 500,
  }

  paths: {
    [path: string]: string
  } = {}

  specs: {
    // is required here (will be filled in automaticly)
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
        } else if (
          isChannelFunctionSpec(spec) &&
          this.server.activeChannels[name]
        ) {
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

    if (this.config.uninstallAfterIdleTime === undefined) {
      this.config.uninstallAfterIdleTime = 60e3 // 1 min
    }
    if (this.config.closeAfterIdleTime === undefined) {
      this.config.closeAfterIdleTime = {
        query: 3e3, // 3 seconds
        channel: 60e3, // 3 1 Min
      }
    }

    if (this.unregisterTimeout) {
      clearTimeout(this.unregisterTimeout)
    }

    this.uninstallLoop()
  }

  async update(name: string, checksum: number) {
    const prevSpec = this.specs[name]

    if (prevSpec && prevSpec.checksum !== checksum) {
      if (this.beingUninstalled[name]) {
        delete this.beingUninstalled[name]
      }
      const spec = await this.installGaurdedFromConfig(name)
      await this.config.uninstall({
        server: this.server,
        function: prevSpec,
        name,
      })
      if (spec) {
        this.updateInternal(spec)
      }
    }
  }

  private async installGaurdedFromConfig(
    name: string
  ): Promise<BasedSpec | null> {
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

  async install(name: string): Promise<BasedSpec | null> {
    let spec = this.getFromStore(name)

    if (spec) {
      return spec
    }

    spec = await this.installGaurdedFromConfig(name)

    if (spec) {
      this.updateInternal(spec)
      return this.getFromStore(name)
    }
    return null
  }

  getNameFromPath(path: string): string {
    return this.paths[path]
  }

  route(name?: string, path?: string): BasedRoute | null {
    return this.config.route({ server: this.server, name, path })
  }

  getFromStore(name: string): BasedSpec | null {
    const spec = this.specs[name]
    if (spec) {
      if (this.beingUninstalled[name]) {
        delete this.beingUninstalled[name]
      }
      updateTimeoutCounter(spec)
      return spec
    }
    return null
  }

  updateInternal(spec: BasedSpec): boolean {
    if (!spec) {
      return false
    }

    // Case when functions are installed exactly at the same time
    if (deepEqual(spec, this.specs[spec.name])) {
      return false
    }

    if (!spec.uninstallAfterIdleTime) {
      spec.uninstallAfterIdleTime = this.config.uninstallAfterIdleTime
    }

    if (spec.timeoutCounter === undefined) {
      spec.timeoutCounter =
        spec.uninstallAfterIdleTime === 0
          ? -1
          : Math.ceil(spec.uninstallAfterIdleTime / 1e3)
    }

    if (spec.path) {
      this.paths[spec.path] = spec.name
    }

    if (!spec.maxPayloadSize) {
      if (isChannelFunctionSpec(spec)) {
        spec.maxPayloadSize = this.maxPayLoadSizeDefaults.channel
      } else if (isQueryFunctionSpec(spec)) {
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

    if (this.specs[spec.name] && this.server.activeChannels[spec.name]) {
      if (!isChannelFunctionSpec(spec)) {
        for (const [id] of this.server.activeChannels[spec.name]) {
          destroyChannel(this.server, id)
        }
      } else {
        if (previousChecksum !== spec.checksum) {
          for (const [id] of this.server.activeChannels[spec.name]) {
            startChannel(this.server, id, true)
          }
        }
      }
    } else if (
      this.specs[spec.name] &&
      this.server.activeObservables[spec.name]
    ) {
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

    if (spec.uninstall) {
      await spec.uninstall()
    }

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
