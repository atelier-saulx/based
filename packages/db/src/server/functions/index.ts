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
} from '../../functions/index.js'
import { deepMerge, deepEqual } from '../../utils/index.js'
import { FunctionConfig } from './types.js'
import { fnIsTimedOut, updateTimeoutCounter } from './timeout.js'
import { destroyObs, start } from '../query/index.js'
import { destroyChannel, startChannel } from '../channel/index.js'
import { genVersion } from './genVersion.js'
import { pathMatcher, tokenizePattern } from '../incoming/http/pathMatcher.js'
import { SLASH } from '../incoming/http/types.js'

export * from './types.js'

export class BasedFunctions {
  server: BasedServer

  reqId: number = 0

  config: FunctionConfig

  unregisterTimeout: NodeJS.Timeout

  installsInProgress: Record<string, Promise<any>> = {}

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
      this.config.route = ({ path, name }) => {
        if (path) {
          let route: BasedRouteComplete | null | undefined

          if (path === '/' && this.routes[this.paths['/']]) {
            const r = this.routes[this.paths['/']]
            if (r && !r.tokens) {
              this.generateRoute(r)
            }
            return r
          }

          if (path) {
            route = this.getRoute(path)
          }

          // deprecate this.routes[this.paths['/']]
          const rr =
            route ||
            this.routes[path] ||
            this.routes['404'] ||
            this.routes[this.paths['/']] ||
            null

          // FIXME: dirty hack
          if (rr && !rr.tokens) {
            this.generateRoute(rr)
          }

          return rr
        } else {
          return this.routes[name as string] || null
        }
      }
    } else {
      // FIXME: tmp dirty hack
      const tmpRoute = this.config.route
      this.config.route = (x) => {
        if (x.path) {
          const r = tmpRoute(x)
          if (r && !r.tokens) {
            this.generateRoute(r)
          }
          return r
        } else {
          return tmpRoute(x)
        }
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

  route(
    externalName?: string,
    externalPath?: string,
  ): BasedRouteComplete | null {
    return this.config.route!({ path: externalPath, name: externalName })
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
      const nRoute = this.generateRoute(this.routes[key], key)
      if (nRoute !== null) {
        this.updateRoute(nRoute, key)
      }
    }
  }

  completeSpec(
    spec: Optional<BasedFunctionConfig, 'name'>,
    name?: string,
  ): null | BasedFunctionConfigComplete {
    this.generateRoute(spec, name)
    if (!spec.version) {
      // @ts-ignore added name allready
      spec.version = genVersion(spec)
    }
    const nSpec = spec as BasedFunctionConfigComplete
    return nSpec
  }

  generateRoute(
    route: Optional<BasedRoute, 'name'>,
    name?: string,
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
      let finalPath: string = ''
      if (nRoute.path) {
        finalPath = nRoute.path
        if (nRoute.path.charCodeAt(0) !== SLASH) {
          finalPath = `/${nRoute.path}`
        }
        if (nRoute.path.length >= nRoute.name.length + 1) {
          let match = true
          for (let i = 0; i < nRoute.name.length; i++) {
            if (nRoute.path.charCodeAt(i + 1) !== nRoute.name.charCodeAt(i)) {
              match = false
              break
            }
          }
          if (match) {
            nRoute.nameOnPath = true
          } else {
            finalPath = `/${nRoute.name}` + finalPath
            nRoute.nameOnPath = false
          }
        }
      } else {
        finalPath = `/${nRoute.name}`
        nRoute.nameOnPath = false
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
    name?: string,
  ):
    | null
    | (BasedRoute & {
        maxPayloadSize: number
        rateLimitTokens: number
      }) {
    const realRoute = this.generateRoute(route, name)
    if (realRoute === null) {
      console.log('ROUTE IS NULL INCORRECT')
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
          : Math.ceil(spec.uninstallAfterIdleTime! / 1e3)
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
      const q: Promise<boolean>[] = []
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
      await this.config.uninstall!({
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
    spec?: BasedFunctionConfig | BasedFunctionConfigComplete | null,
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
      await this.config.uninstall!({
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
          name,
        )
      }
    }
    return false
  }

  private async installGaurdedFromConfig(
    name: string,
  ): Promise<BasedFunctionConfigComplete | null> {
    // @ts-ignore
    if (this.installsInProgress[name]) {
      return this.installsInProgress[name]
    }
    this.installsInProgress[name] = this.config.install!({
      server: this.server,
      name,
    })
    const s = await this.installsInProgress[name]
    delete this.installsInProgress[name]
    return s
  }

  // FIXME: greatly refactor this - this is not get Route now thi sis MATCH PATH
  getRoute(path: string): BasedRouteComplete | null {
    // this make it heavier im affraid
    const bufferPath = Buffer.from(path)
    for (const key in this.routes) {
      const route = this.routes[key]

      if (pathMatcher(route.tokens!, bufferPath)) {
        return route
      }
    }
    for (const key in this.routes) {
      const route = this.routes[key]

      if (!route.nameOnPath) {
        if (pathMatcher(route.tokens!.slice(1), bufferPath)) {
          return route
        }
      }
    }
    return null
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
