import type { AuthState, BasedClient } from '@based/client'
import type { BasedFunctionConfig } from '@based/functions'
import type { BasedQuery } from '@based/functions'
import type { Separator } from '@inquirer/prompts'
import type { AppContext } from './shared/index.js'

declare global {
  namespace Based {
    namespace API {
      type Client = {
        call<T extends Based.API.Gateway.Endpoint>(
          gatewayFunction: T,
          payload?: unknown,
        ): T extends { type: 'query' } ? BasedQuery : Promise

        destroy: () => void
        get: (client: Based.API.Gateway.Endpoint['client']) => BasedClient
      }

      namespace Gateway {
        type EndpointBase = {
          client: 'cluster' | 'env' | 'project' | 'local'
          endpoint: string
        }

        type QueryEndpoint = EndpointBase & {
          type: 'query'
        }

        type CallEndpoint = EndpointBase & { type: 'call' }

        type StreamEndpoint = EndpointBase & {
          type: 'stream'
        }

        type RestEndpoint = EndpointBase & {
          type: 'rest'
        }

        type Endpoint =
          | QueryEndpoint
          | CallEndpoint
          | StreamEndpoint
          | RestEndpoint

        type Endpoints<T extends Record<string, Endpoint>> = {
          [K in keyof T]: Endpoint
        }
      }
    }

    namespace Context {
      type MouseEvent = {
        button: number
        state: string
        x: number
        y: number
        motion: boolean
        shift: boolean
        meta: boolean
        ctrl: boolean
      }

      type DirectionsEvent = {
        name: 'up' | 'down' | 'left' | 'right'
        from: 'mouse' | 'keyboard' | 'wheel'
      }

      type Project = {
        cluster?: string
        project?: string
        org?: string
        env?: string
        apiKey?: string
        file?: string
      }

      type GlobalOptions<T extends 'yes' | 'skip'> = T extends 'yes'
        ? Based.Context.Project & {
            display?: State['display']
            yes?: boolean
          }
        : Based.Context.Project & {
            display?: State['display']
            skip?: boolean
          }

      type State = {
        display: 'verbose' | 'info' | 'success' | 'warning' | 'error' | 'silent'
        emojis: {
          warning: string
          success: string
          error: string
          info: string
          pipe: string
        }
      }

      type Parse = {
        date: (
          value: string | Date,
          formatIN?: string,
          formatOUT?: string,
        ) => {
          value: string
          date: Date
          timestamp: number
        }
      }

      interface Spinner {
        start: (message?: string, timeout?: number) => this
        stop: (message?: string) => this
        text: (message?: string) => this
        isActive: boolean
      }

      type PrintMethodBase = (message: string, icon?: boolean | string) => this

      interface Print {
        intro: (message: string) => this
        outro: (message: string) => this
        step: PrintMethodBase
        info: PrintMethodBase
        success: PrintMethodBase
        warning: PrintMethodBase
        fail: (
          message: string,
          icon?: boolean | string,
          killCode?: number | false,
        ) => void
        line: () => this
        pipe: (message?: string) => this
        separator: (width?: number) => this
      }

      type SelectInputItems =
        | {
            name?: string
            description?: string
            value: string | null | unknown
          }
        | Separator

      type DateTimeResult = {
        value: string
        date: Date
        timestamp: number
      }

      type InputHandler = {
        date: (
          message: string,
          skip?: boolean,
          today?: boolean,
          format?: string,
        ) => Promise<DateTimeResult | null>
        dateTime: (
          message: string,
          skip?: boolean,
          now?: boolean,
          format?: string,
        ) => Promise<DateTimeResult | null>
        number: (message: string, skip?: boolean) => Promise<string | null>
        email: (message: string) => Promise<string>
        confirm: (
          message?: string,
          positive?: string,
          negative?: string,
          initialValue?: boolean,
        ) => Promise<boolean>
        default: (
          message: string,
          defaultValue: string,
          skip?: boolean,
          validate?: (
            value: string,
          ) => boolean | string | Promise<string | boolean>,
        ) => Promise<string>
        select: (
          message: string,
          choices: Based.Context.SelectInputItems[],
          multiSelection?: boolean,
          separator?: boolean,
        ) => Promise
      }

      namespace Terminal {
        type Get = {
          title: string
          header?: string[]
          rows?: {
            sort?: 'asc' | 'desc'
          }
          scrollMode?: 'item' | 'index'
        }

        type ContentRaw = string | string[]
        type ContentPrepared = string[]

        type ContentFunction = (
          content: Based.Context.Terminal.ContentRaw,
        ) => void

        type ReturnedFunctions = {
          render: () => void
          kill: (fn: function) => void
          header: TerminalContentFunction
          addRow: TerminalContentFunction
          setTable?: () => void
          autoScroll?: boolean
        }
      }
    }

    namespace Commands {
      type Names =
        | 'auth'
        | 'disconnect'
        | 'globalOptions'
        | 'backups'
        | 'logs'
        | 'test'
        | 'infra'
        | 'deploy'
        | 'dev'
        | 'init'

      type SubCommandsList = Record<
        string,
        (program: Command) => (...args: unknown[]) => Promise<void> | void
      >
    }

    namespace Auth {
      type Command = {
        email?: string
      }

      type AuthenticatedUser = AuthState & {
        email: string
        ts: number
      }

      type Login = {
        email?: string
        selectUser?: boolean
      }
    }

    namespace Init {
      type Command = Based.Context.Project & {
        name?: string
        description?: string
        path?: string
        format?: Based.Extensions
        dependencies?: srtring[]
        devDependencies?: srtring[]
        queries?: string[]
        functions?: string[]
      }

      type Make = {
        context: AppContext
        project: Based.Init.Command
      }
    }

    namespace Backups {
      type Sorted = {
        databases: number
        backups: number
        sorted: Based.Backups.Selection
      }

      type Info = {
        key: string
        lastModified: string
        size: number
      }

      type Selection = {
        [key: string]: Based.Backups.Info[]
      }

      namespace Download {
        type Command = {
          db?: string
          file?: string
          path?: string
          date?: string
        }

        type Get = {
          context: AppContext
          db?: string
          file?: string
          date?: string
          path?: string
          retry?: number
        }
      }

      namespace Flush {
        type Command = {
          db?: string
          force?: boolean
        }

        type Set = Omit<Context.Project, 'apiKey' | 'file'> & {
          context: AppContext
          db?: string
          force: boolean
        }
      }

      namespace List {
        type Command = {
          limit: number
          sort: string
        }

        type Get = {
          context: AppContext
          limit?: number
          sort?: string
          verbose?: boolean
        }
      }

      namespace Restore {
        type Command = {
          db?: string
          file?: string
          date?: string
        }

        type Set = {
          context: AppContext
          db?: string
          file?: string
          date?: string
          verbose: boolean
        }
      }
    }

    namespace Infra {
      namespace Init {
        type Command = {
          name?: string
          description?: string
          standby?: boolean
          domains?: string[]
          machine?: string
          min?: string | number
          max?: string | number
          path?: string
          format?: Based.Extensions
        }

        type Make = {
          context: AppContext
          infra: Based.Infra.Init.Command
        }
      }

      namespace Get {
        type Command = {
          machine?: string
          machines?: Based.Infra.Template['machineConfigs']
          path?: string
          format?: 'ts' | 'json' | 'js'
        }

        type Save = {
          context: AppContext
          infra: Based.Infra.Get.Command
        }
      }

      namespace Overview {
        type Command = {
          stream?: boolean
          monitor?: boolean
        }

        type Get = {
          context: AppContext
          stream: boolean
          monitor: boolean
        }
      }

      type TemplateInfo = Omit<Based.Infra.Init, 'path' | 'format'>

      type Services =
        | '@based/env-hub-discovery'
        | '@based/env-registry'
        | '@based/env-config-db'
        | '@based/env-db'
        | '@based/env-db-registry'
        | '@based/env-db-sub-manager'
        | '@based/env-events-hub'
        | '@based/env-jobs'
        | '@based/env-metrics-db'

      type UserEnvs = {
        id: string
        name: string
        envs: {
          org: string
          project: string
          env: string
        }[]
      }

      type ParsedUserEnvs = {
        org?: {
          project: string[]
        }
      }

      type Template = {
        autoStandby: boolean
        suspended: boolean
        machineConfigs: {
          [key: string]: {
            configName: Based.Infra.Init['name']
            description: Based.Infra.Init['description']
            domains: Based.Infra.Init['domains']
            machine: Based.Infra.Init['machine']
            min: Based.Infra.Init['min']
            max: Based.Infra.Init['max']
            services: {
              [key: Based.Infra.Services]: {
                distChecksum: string
                instances: {
                  [key: string]: {
                    name?: string
                    port: number
                    disableAllSecurity: boolean
                  }
                }
              }
            }
          }
        }
      }
    }

    namespace Logs {
      namespace Filter {
        type Command = {
          monitor?: boolean
          stream?: boolean
          collapsed?: boolean
          app?: boolean
          infra?: boolean
          level?: 'all' | 'info' | 'error'
          limit?: number
          sort?: 'asc' | 'desc'
          startDate?: Context.DateTimeResult | string | null
          endDate?: Context.DateTimeResult | string | null
          checksum?: number
          function?: string | string[]
          service?: string | string[]
          machine?: string | string[]
        }
      }

      type EnvLogsData = {
        cs: number
        lvl?: 'error' | 'info'
        ts: number
        fn: string
        msg: string
      }

      type AdminLogsData = {
        i: string // instance id/key
        eid: string
        lvl?: 'error' | 'info'
        ts: number
        mid: string // machine id
        url: string // ip/url
        srvc: string
        msg: string
      }

      type RenderData = (data: AdminLogsData[] | EnvLogsData[]) => void
    }

    namespace Tests {
      type Command = {
        command?: string
        backup?: boolean
        restore?: boolean
        db?: string
        file?: string
        date?: string
      }
    }

    type ConfigBase = BasedFunctionConfig & {
      type: 'authorize' & BasedFunctionConfig['type']
      main: string
      appParams?: {
        js?: string
        css?: string
        favicon?: string
      }
      files?: string[]
    }

    type ConfigStore = {
      config: ConfigBase
      path: string
      dir: string
      index?: string
      app?: string
      favicon?: string
    }
  }
}

// biome-ignore lint/complexity/noUselessEmptyExport: This is required. This file need to be recognized as a module.
export {}
