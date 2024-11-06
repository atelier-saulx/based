import { BasedFunctionConfig } from '@based/functions'
import { Separator } from '@inquirer/prompts'
import { AuthState, BasedClient } from '@based/client'
import { BasedQuery } from '@based/functions'
import { AppContext } from './shared/index.js'
import { cloudFunctions } from './shared/cloudFunctions'

declare global {
  namespace Based {
    namespace API {
      type Client = {
        call<T extends Based.API.Gateway.Endpoint>(
          gatewayFunction: T,
          payload?: any,
        ): T extends { type: 'query' } ? BasedQuery<any> : Promise<any>

        destroy: () => void
        get: (client: Based.API.Gateway.Endpoint['client']) => BasedClient
      }

      namespace Gateway {
        type EndpointBase = {
          client: 'cluster' | 'env' | 'project'
          endpoint: string
        }

        type QueryEndpoint = EndpointBase & {
          type: 'query'
        }

        type CallEndpoint = EndpointBase & { type: 'call' }

        type StreamEndpoint = EndpointBase & {
          type: 'stream'
        }

        type Endpoint = QueryEndpoint | CallEndpoint | StreamEndpoint

        type Endpoints<T extends Record<string, Endpoint>> = {
          [K in keyof T]: Endpoint
        }
      }
    }

    type File = 'based' | 'based.schema' | 'based.config' | 'based.infra'
    type Extensions = 'js' | 'json' | 'ts'

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
        ? {
            display?: State['display']
            yes?: boolean
          }
        : {
            display?: State['display']
            skip?: boolean
          }

      type State = {
        [key: string]: any
        display: 'verbose' | 'info' | 'success' | 'warning' | 'error' | 'silent'
        emojis: {
          warning: string
          success: string
          error: string
          info: string
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

      interface MessageHandler {
        loading: (message: string, timeout?: number) => this
        stop: () => this
        info: (message: string, icon?: boolean | string) => this
        success: (message?: string, icon?: boolean | string) => this
        warning: (message: string, icon?: boolean | string) => this
        fail: (
          message: string,
          icon?: boolean | string,
          killCode?: number,
        ) => void
        line: () => this
        separator: (width?: number) => this
      }

      type SelectInputItems =
        | {
            name?: string
            description?: string
            value: any
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
        confirm: (message?: string, defaultValue?: boolean) => Promise<boolean>
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
          choices: SelectInputItems[],
          multiSelection?: boolean,
          separator?: boolean,
        ) => Promise<any>
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
          kill: (fn: any) => void
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
        | 'globalOptions'
        | 'backups'
        | 'logs'
        | 'test'
        | 'infra'
        | 'deploy'
        | 'dev'

      type SubCommandsList = Record<
        string,
        (program: Command) => (...args: any[]) => Promise<void> | void
      >
    }

    namespace Auth {
      type User = {
        email: string
        userId?: string
        token?: string
        ts?: number
      }

      type AuthenticatedUser = AuthState & {
        email: string
      }

      type Login = {
        email?: string
        selectUser?: boolean
      }
    }

    namespace Backups {
      type Downloads = {
        context: AppContext
        db?: string
        file?: string
        date?: string
        path?: string
        retry?: number
      }

      type Flush = Context.Project & {
        context: AppContext
        db?: string
        force: boolean
      }

      type Restore = {
        context: AppContext
        db?: string
        file?: string
        date?: string
        verbose: boolean
      }
    }

    namespace Infra {
      type Init = {
        name?: string
        description?: string
        domains?: string[]
        machine?: string
        min?: string | number
        max?: string | number
        path?: string
        format?: Based.Extensions
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

      type Template = {
        env: {
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
                  port: number
                }
              }
            }
          }
        }
      }
    }

    namespace Logs {
      type Filter = {
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

    namespace Infra {
      type Overview = {}
    }

    type ConfigBase = BasedFunctionConfig & {
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

export {}
