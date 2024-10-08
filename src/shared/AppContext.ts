import { Command } from 'commander'
import {
  contextBasedClients,
  contextGlobalOptions,
  contextParse,
  contextProgram,
  contextInput,
  contextPrint,
} from '../helpers/index.js'

export class AppContext {
  private static instance: AppContext
  private state: BasedCli.Context.State = {
    display: 'verbose',
    emojis: {
      info: '💬',
      success: '✨',
      warning: '⚠️',
      error: '🚨',
    },
  }
  private logLevels: string[] = [
    'verbose',
    'info',
    'success',
    'warning',
    'error',
    'silent',
  ]
  public program: Command

  private constructor(program: Command) {
    if (!this.program) {
      this.program = program
    }
  }

  public static getInstance(program: Command): AppContext {
    if (!AppContext.instance) {
      if (!program) {
        throw new Error('Program must be provided.')
      }

      AppContext.instance = new AppContext(program)
    }
    return AppContext.instance
  }

  public set(key: string, value: any) {
    if (key === 'display' && !this.logLevels.includes(value)) {
      value = 'verbose'
    }

    this.state[key] = value
  }

  public get(key: string) {
    return this.state[key]
  }

  public getGlobalOptions = contextGlobalOptions
  public getBasedClients = contextBasedClients
  public getProgram = contextProgram
  public parse = contextParse
  public input = contextInput
  public print = contextPrint(this.state)
}
