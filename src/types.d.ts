import { BasedFunctionConfig } from '@based/functions'
import { Separator } from '@inquirer/prompts'

declare global {
  namespace BasedCli {
    namespace Context {
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
    }

    namespace Logs {
      namespace Filter {
        type Args = {
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

    namespace Backups {
      namespace List {
        type Args = {
          limit?: number
          sort?: 'asc' | 'desc'
        }
      }
    }
  }
}

export {}
