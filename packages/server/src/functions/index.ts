import type { BasedServer } from '../server.js'
import { Optional } from 'utility-types'
import {
  BasedRoute,
  BasedFunctionConfig,
  BasedFunctionConfigs,
  BasedRoutes,
  isBasedFunctionConfig,
  BasedFunctionConfigComplete,
  BasedRouteComplete,
} from '@based/functions'
import { deepMerge, deepEqual } from '@saulx/utils'
import { FunctionConfig } from './types.js'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout.js'
import { destroyObs, start } from '../query/index.js'
import { destroyChannel, startChannel } from '../channel/index.js'
import { genVersion } from './genVersion.js'
import { pathMatcher, tokenizePattern } from '../incoming/http/pathMatcher.js'

export * from './types.js'

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
    [name: string]: BasedFunctionConfigComplete
  } = {}

  routes: {
    [name: string]: BasedRouteComplete
  } = {}

  beingUninstalled: {
    [name: string]: boolean
  } = {}

  constructor(server: BasedServer, config?: FunctionConfig) {
    this.server = server
    if (config) {
      this.updateConfig(config)
    } else {
      this.updateConfig({})
    }
  }

  updateConfig(fullConfig: FunctionConfig) {
    const { routes, configs, ...config } = fullConfig

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
        query: 3e3, // 3 seconds - get it higher e.g 20 seconds / and cache size
        channel: 60e3, // 3 1 Min
      }
    }

    if (this.config.route === undefined) {
      this.config.route = ({ path }) => {  
        let route: BasedRouteComplete

        if (path === '/') {
          return this.routes[this.paths['/']]
        }
        
        if (path) {
          route = this.getRoute(path)
        }

        return route || this.routes[path] || this.routes[this.paths['/']] || null
      }
    }

    if (this.config.install === undefined) {
      this.config.install = async ({ name }) => {
        return this.getFromStore(name)
      }
    }

    if (this.config.uninstall === undefined) {
      this.config.uninstall = async () => {
        return true
      }
    }

    if (routes) {
      this.addRoutes(routes)
    }

    if (configs) {
      this.add(configs)
    }

    if (this.unregisterTimeout) {
      clearTimeout(this.unregisterTimeout)
    }

    this.uninstallLoop()
  }

  route(externalName?: string, externalPath?: string): BasedRouteComplete | null {
    return this.config.route({ path: externalPath || externalName })
  }

  async install(name: string): Promise<BasedFunctionConfigComplete | null> {
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

  add(specs: BasedFunctionConfigs) {
    for (const key in specs) {
      const s = this.completeSpec(specs[key], key)
      if (s === null) {
        continue
      }
      if (s.uninstallAfterIdleTime === undefined) {
        s.uninstallAfterIdleTime = 0
      }
      this.updateInternal(s)
    }
  }

  addRoutes(routes: BasedRoutes) {
    for (const key in routes) {
      const nRoute = this.completeRoute(this.routes[key], key)
      if (nRoute !== null) {
        this.updateRoute(nRoute, key)
      }
    }
  }

  completeSpec(
    spec: Optional<BasedFunctionConfig, 'name'>,
    name?: string
  ): null | BasedFunctionConfigComplete {
    if (this.completeRoute(spec, name) === null) {
      console.error('cannot completeSpec', name, spec)
      return null
    }
    if (!spec.version) {
      // @ts-ignore added name allready
      spec.version = genVersion(spec)
    }
    const nSpec = spec as BasedFunctionConfigComplete
    return nSpec
  }

  completeRoute(
    route: Optional<BasedRoute, 'name'>,
    name?: string
  ): null | BasedRouteComplete {
    const nRoute = route as BasedRouteComplete
    if (!nRoute.type) {
      console.error('Type is required for based-routes', name)
      return null
    }
    if (!nRoute.name) {
      if (!name) {
        console.error('No based-route name', route)
        return null
      }
      nRoute.name = name
    }
    if (!route.maxPayloadSize) {
      route.maxPayloadSize = this.maxPayLoadSizeDefaults[route.type]
    }
    if (nRoute.rateLimitTokens === undefined) {
      nRoute.rateLimitTokens = 1
    }
    if (!nRoute.tokens) {
      let finalPath: string = `/${nRoute.name}`
      
      if (nRoute.path) {
        const clearPath = nRoute.path.replace(`/${nRoute.name}`, '')
        finalPath += clearPath
      }
      
      nRoute.tokens = tokenizePattern(Buffer.from(finalPath))
    }
    
    return nRoute
  }

  async removeRoute(name: string) {
    const route = this.routes[name]
    if (route) {
      if (route.path) {
        delete this.paths[route.path]
      }
      delete this.routes[route.name]
    }
    return this.uninstall(name)
  }

  updateRoute(
    route: BasedRouteComplete,
    name?: string
  ):
    | null
    | (BasedRoute & {
        maxPayloadSize: number
        rateLimitTokens: number
      }) {
    const realRoute = this.completeRoute(route, name)
    if (realRoute === null) {
      return null
    }
    if (realRoute.path) {
      this.paths[realRoute.path] = realRoute.name
    }
    this.routes[route.name] = realRoute
    return realRoute
  }

  updateInternal(spec: BasedFunctionConfigComplete): boolean {
    if (!spec) {
      return false
    }
    if (deepEqual(spec, this.specs[spec.name])) {
      return false
    }
    if (this.updateRoute(spec) === null) {
      return false
    }
    if (spec.uninstallAfterIdleTime === undefined) {
      spec.uninstallAfterIdleTime = this.config.uninstallAfterIdleTime
    }
    if (spec.timeoutCounter === undefined) {
      spec.timeoutCounter =
        spec.uninstallAfterIdleTime === 0 || spec.uninstallAfterIdleTime === -1
          ? -1
          : Math.ceil(spec.uninstallAfterIdleTime / 1e3)
    }
    if (spec.path) {
      this.paths[spec.path] = spec.name
    }

    const previousChecksum = this.specs[spec.name]?.version ?? -1
    // @ts-ignore maxpayload and rlimit tokens added....
    this.specs[spec.name] = spec
    if (this.specs[spec.name] && this.server.activeChannels[spec.name]) {
      if (!isBasedFunctionConfig('channel', spec)) {
        for (const [id] of this.server.activeChannels[spec.name]) {
          destroyChannel(this.server, id)
        }
      } else {
        if (previousChecksum !== spec.version) {
          for (const [id] of this.server.activeChannels[spec.name]) {
            startChannel(this.server, id, true)
          }
        }
      }
    } else if (
      this.specs[spec.name] &&
      this.server.activeObservables[spec.name]
    ) {
      if (!isBasedFunctionConfig('query', spec)) {
        for (const [id] of this.server.activeObservables[spec.name]) {
          destroyObs(this.server, id)
        }
      } else {
        if (previousChecksum !== spec.version) {
          for (const [id] of this.server.activeObservables[spec.name]) {
            start(this.server, id)
          }
        }
      }
    }
    return true
  }

  uninstallLoop() {
    this.unregisterTimeout = setTimeout(async () => {
      const q = []
      for (const name in this.specs) {
        const spec = this.specs[name]
        if (
          isBasedFunctionConfig('query', spec) &&
          this.server.activeObservables[name]
        ) {
          updateTimeoutCounter(spec)
        } else if (
          isBasedFunctionConfig('channel', spec) &&
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

  async update(name: string, checksum: number) {
    const prevSpec = this.specs[name]
    if (prevSpec && prevSpec.version !== checksum) {
      if (this.beingUninstalled[name]) {
        delete this.beingUninstalled[name]
      }
      const spec = await this.installGaurdedFromConfig(name)
      await this.config.uninstall({
        server: this.server,
        config: prevSpec,
        name,
      })
      if (spec) {
        this.updateInternal(spec)
      }
    }
  }

  async uninstall(
    name: string,
    spec?: BasedFunctionConfig | BasedFunctionConfigComplete | null
  ): Promise<boolean> {
    if (this.beingUninstalled[name]) {
      console.error('Function already being uninstalled...', name)
    }
    if (!spec && spec !== null) {
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
        config: spec,
        name,
      })
    ) {
      if (this.beingUninstalled[name]) {
        delete this.beingUninstalled[name]
        return this.remove(name)
      } else {
        console.info(
          'Fn requested while being unregistered from uninstall',
          name
        )
      }
    }
    return false
  }

  private async installGaurdedFromConfig(
    name: string
  ): Promise<BasedFunctionConfigComplete | null> {
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

  getRoute(path: string): BasedRouteComplete | null {    
    let i: number = 0
    let removeNameFromTokens: boolean = false
    let tokens = []
    const bufferPath = Buffer.from(path)
    const routesKeys = Object.keys(this.routes)
        
    while (i < routesKeys.length) {
      tokens = [...this.routes[routesKeys[i]].tokens]      

      if (removeNameFromTokens && tokens) {
        tokens.shift()        
      }

      if (pathMatcher(tokens, bufferPath)) {
        if (tokens.length === this.routes[routesKeys[i]].tokens.length) {
          return this.routes[routesKeys[i]]
        }

        return {
          ...this.routes[routesKeys[i]],
          tokens
        }
      }

      i++

      if (i === routesKeys.length && !removeNameFromTokens) {
        removeNameFromTokens = true
        i = 0        
      }

      if (i === routesKeys.length && removeNameFromTokens) {
        return null
      }
    }
  }

  getFromStore(name: string): BasedFunctionConfigComplete | null {
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

  remove(name: string): boolean {
    const spec = this.specs[name]
    if (!spec) {
      return false
    }
    if (isBasedFunctionConfig('query', spec)) {
      const activeObs = this.server.activeObservables[name]
      if (activeObs) {
        for (const [id] of activeObs) {
          destroyObs(this.server, id)
        }
        delete this.server.activeObservables[name]
      }
    }
    if (isBasedFunctionConfig('channel', spec)) {
      const activeChannel = this.server.activeChannels[name]
      if (activeChannel) {
        for (const [id] of activeChannel) {
          destroyChannel(this.server, id)
        }
        delete this.server.activeChannels[name]
      }
    }
    delete this.specs[name]
    return true
  }
}
