import { spinner } from './spinner.js'
import { parseMessage } from './parseMessage.js'

interface MessageHandler {
  loading: (message: string, timeout?: number) => this
  stop: () => void
  info: (message: string) => this
  success: (message: string) => this
  warning: (message: string) => this
  fail: (message: string, killCode?: number) => void
  line: () => this
  separator: () => this
}

type AppContextState = {
  [key: string]: any
  level: 'verbose' | 'info' | 'success' | 'warning' | 'error' | 'silent'
}

class AppContext {
  private static instance: AppContext
  private state: AppContextState = {
    level: 'verbose',
  }

  private constructor() {}

  public static getInstance(): AppContext {
    if (!AppContext.instance) {
      AppContext.instance = new AppContext()
    }
    return AppContext.instance
  }

  public set(key: string, value: any) {
    this.state[key] = value
  }

  public get(key: string) {
    return this.state[key]
  }

  public print: MessageHandler = {
    loading: (message: string): MessageHandler => {
      if (
        this.state.level === 'silent' ||
        this.state.level === 'error' ||
        this.state.level === 'warning'
      ) {
        return this.print
      }

      spinner.start(parseMessage(message))
      return this.print
    },
    stop: (): void => {
      spinner.stop()
    },
    info: (message: string): MessageHandler => {
      if (
        this.state.level === 'silent' ||
        this.state.level === 'error' ||
        this.state.level === 'warning' ||
        this.state.level === 'success'
      ) {
        return this.print
      }

      console.info(parseMessage(message))
      return this.print
    },
    success: (message: string): MessageHandler => {
      if (
        this.state.level === 'silent' ||
        this.state.level === 'error' ||
        this.state.level === 'warning' ||
        this.state.level === 'info'
      ) {
        return this.print
      }

      spinner.succeed(parseMessage(message))
      return this.print
    },
    warning: (message: string): MessageHandler => {
      if (
        this.state.level === 'silent' ||
        this.state.level === 'error' ||
        this.state.level === 'success' ||
        this.state.level === 'info'
      ) {
        return this.print
      }

      console.warn(parseMessage(message))
      return this.print
    },
    fail: (message: string, killCode: number = 1): void => {
      if (
        this.state.level === 'silent' ||
        this.state.level === 'success' ||
        this.state.level === 'warning' ||
        this.state.level === 'info'
      ) {
        return
      }

      spinner.fail(parseMessage(message))
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
