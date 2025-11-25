import {
  BasedFunctionConfig,
  BasedRoutes,
  BasedRouteComplete,
  BasedFunctionConfigs,
  BasedFunctionConfigComplete,
} from '../../functions/index.js'
import { BasedServer } from '../server.js'

export type FunctionConfig = {
  /** Default number to close channels & queries when no subscribers are active in ms */
  closeAfterIdleTime?: {
    query: number
    channel: number
  }
  /** Default time to uinstall function after it has been idle in ms */
  uninstallAfterIdleTime?: number
  /** Default max payload sizes in bytes */
  maxPayLoadSizeDefaults?: {
    stream: number
    query: number
    function: number
    channel: number
  }
  route?: (opts: { name?: string; path?: string }) => null | BasedRouteComplete
  install?: (opts: {
    server: BasedServer
    name: string
    config?: BasedFunctionConfig | BasedFunctionConfigComplete
  }) => Promise<null | BasedFunctionConfigComplete>
  uninstall?: (opts: {
    server: BasedServer
    name: string
    config: BasedFunctionConfig | BasedFunctionConfigComplete
  }) => Promise<boolean>
  configs?: BasedFunctionConfigs
  routes?: BasedRoutes
}
