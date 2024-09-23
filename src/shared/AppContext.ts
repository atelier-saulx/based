import { spinner } from './spinner.js'
import { parseMessage } from './parseMessage.js'
import { checkbox, input, select, Separator } from '@inquirer/prompts'
import { isValid } from 'date-fns/isValid'
import { parse } from 'date-fns'
import confirm from '@inquirer/confirm'

interface MessageHandler {
  loading: (message: string, timeout?: number) => this
  stop: () => this
  info: (message: string, icon?: boolean | string) => this
  success: (message?: string, icon?: boolean | string) => this
  warning: (message: string, icon?: boolean | string) => this
  fail: (message: string, icon?: boolean | string, killCode?: number) => void
  line: () => this
  separator: () => this
}

export type SelectInputItems =
  | {
      name?: string
      description?: string
      value: any
    }
  | Separator

interface InputHandler {
  date: (message: string, skip?: boolean) => Promise<string>
  number: (message: string, skip?: boolean) => Promise<string>
  email: (message: string) => Promise<string>
  confirm: (message?: string, defaultValue?: boolean) => Promise<boolean>
  default: (
    message: string,
    defaultValue: string,
    validate?: (value: string) => boolean | string | Promise<string | boolean>,
  ) => Promise<string>
  select: (
    message: string,
    choices: SelectInputItems[],
    multiSelection?: boolean,
    separator?: boolean,
  ) => Promise<any>
}

type AppContextState = {
  [key: string]: any
  level: 'verbose' | 'info' | 'success' | 'warning' | 'error' | 'silent'
  emojis: {
    warning: string
    success: string
    error: string
    info: string
  }
}

class AppContext {
  private static instance: AppContext
  private state: AppContextState = {
    level: 'verbose',
    emojis: {
      info: '💬',
      success: '✨',
      warning: '⚠️',
      error: '🚨',
    },
  }

  private constructor() {}

  public static getInstance(): AppContext {
    if (!AppContext.instance) {
      AppContext.instance = new AppContext()
    }
    return AppContext.instance
  }

  public set(key: string, value: any) {
    if (
      key === 'level' &&
      value !== 'verbose' &&
      value !== 'info' &&
      value !== 'success' &&
      value !== 'warning' &&
      value !== 'error' &&
      value !== 'silent'
    ) {
      value = 'verbose'
    }

    this.state[key] = value
  }

  public get(key: string) {
    return this.state[key]
  }

  public input: InputHandler = {
    date: async (message: string, skip: boolean = true) =>
      input({
        message: parseMessage(message),
        validate: (value) =>
          (skip && value === 's') ||
          isValid(parse(value, 'dd/MM/yyyy', new Date())),
      }),
    number: async (message: string, skip: boolean = true) =>
      input({
        message: parseMessage(message),
        required: true,
        validate: (value) => (skip && value === 's') || !isNaN(Number(value)),
      }),
    email: async (message: string) =>
      input({
        message: parseMessage(message),
        required: true,
        validate: (email) => {
          const at: number = email.lastIndexOf('@')
          const dot: number = email.lastIndexOf('.')

          return at > 0 && at < dot - 1 && dot < email.length - 2
        },
      }),
    confirm: async (
      message: string = 'Continue?',
      defaultValue: boolean = true,
    ) =>
      confirm({
        message: parseMessage(message),
        default: defaultValue,
      }),
    default: async (
      message: string,
      defaultValue: string = '',
      validate?: (
        value: string,
      ) => boolean | string | Promise<string | boolean>,
    ) =>
      input({
        message: parseMessage(message),
        required: true,
        default: defaultValue,
        validate,
      }),
    select: async (
      message: string,
      choices: SelectInputItems[],
      multiSelection: boolean = false,
      separator: boolean = true,
    ) => {
      if (choices.length > 5 || separator) {
        choices.push(new Separator())
      }

      choices = choices.map((choice) => {
        if (choice instanceof Separator) {
          return choice
        }

        return {
          name: parseMessage(choice.name),
          description: parseMessage(choice.description),
          value: choice.value,
        }
      })

      if (multiSelection) {
        return checkbox({
          message: parseMessage(message),
          choices,
          required: true,
        })
      }

      return select({
        message: parseMessage(message),
        choices,
      })
    },
  }

  private iconDecider = (
    icon: boolean | string,
    defaultValue: string,
  ): string => {
    if (icon === true) {
      return defaultValue
    } else if (icon !== '' && icon !== false) {
      return icon
    }

    return ''
  }

  public print: MessageHandler = {
    loading: (message: string): MessageHandler => {
      if (
        this.state.level === 'verbose' ||
        this.state.level === 'info' ||
        this.state.level === 'success'
      ) {
        spinner.start(parseMessage(message))
      }

      return this.print
    },
    stop: (): MessageHandler => {
      spinner.stop()

      return this.print
    },
    info: (message: string, icon: boolean | string = false): MessageHandler => {
      if (this.state.level === 'verbose' || this.state.level === 'info') {
        if (!icon) {
          console.info(parseMessage(message))
          return this.print
        }

        spinner.stopAndPersist({
          symbol: this.iconDecider(icon, this.state.emojis.info),
          text: parseMessage(message),
        })
      }

      return this.print
    },
    success: (
      message?: string,
      icon: boolean | string = false,
    ): MessageHandler => {
      if (this.state.level === 'verbose' || this.state.level === 'success') {
        if (!icon) {
          console.info(parseMessage(message))
          return this.print
        }

        spinner.stopAndPersist({
          symbol: this.iconDecider(icon, this.state.emojis.success),
          text: parseMessage(message),
        })
      }

      return this.print
    },
    warning: (
      message: string,
      icon: boolean | string = false,
    ): MessageHandler => {
      if (this.state.level === 'verbose' || this.state.level === 'warning') {
        if (!icon) {
          console.info(parseMessage(message))
          return this.print
        }

        spinner.stopAndPersist({
          symbol: this.iconDecider(icon, this.state.emojis.warning),
          text: parseMessage(message),
        })
      }

      return this.print
    },
    fail: (
      message: string,
      icon: boolean | string = false,
      killCode: number = 1,
    ): void => {
      if (this.state.level === 'verbose' || this.state.level === 'error') {
        if (!icon) {
          console.info(parseMessage(message))
          process.exit(killCode)
        }

        spinner.stopAndPersist({
          symbol: this.iconDecider(icon, this.state.emojis.error),
          text: parseMessage(message),
        })
      }

      process.exit(killCode)
    },
    line: (): MessageHandler => {
      if (this.state.level === 'silent') {
        return this.print
      }

      console.info('')

      return this.print
    },
    separator: (width: number = 15): MessageHandler => {
      if (this.state.level === 'silent') {
        return this.print
      }

      console.info('─'.repeat(width))

      return this.print
    },
  }
}

export default AppContext
