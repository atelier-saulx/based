import { Command } from 'commander'
import {
  contextBasedClients,
  contextGlobalOptions,
  contextParse,
  contextProgram,
  contextInput,
  contextPrint,
  contextCommandMaker,
} from '../helpers/index.js'
import { i18n } from '@based/i18n'
import { languages } from '../i18n/index.js'

export class AppContext {
  private static instance: AppContext
  private state: Based.Context.State = {
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
  public i18n: ReturnType<typeof i18n<typeof languages>>
  public commandMaker = contextCommandMaker
  public getGlobalOptions = contextGlobalOptions
  public getProgram = contextProgram
  public getBasedClients = contextBasedClients
  public parse = contextParse
  public input = contextInput(this)
  public print = contextPrint(this.state)

  private constructor(program?: Command, internationalization?: any) {
    if (!program && !this.program) {
      throw new Error('Program must be provided.')
    } else if (program && !this.program) {
      this.program = program
    }

    if (internationalization) {
      const defaultLanguage = internationalization.default || 'en'

      this.set('languages', internationalization.languages)
      this.set('language', defaultLanguage)

      this.i18n = i18n(internationalization)
    }
  }

  public static getInstance(program?: Command, languages?: any): AppContext {
    if (!AppContext.instance) {
      AppContext.instance = new AppContext(program, languages)
    }

    return AppContext.instance
  }

  public set(key: string, value: any) {
    if (key === 'display' && !this.logLevels.includes(value)) {
      value = 'verbose'
    }

    this.state[key] = value
  }

  public put(key: string, value: any) {
    if (Array.isArray(this.state[key])) {
      this.state[key] = [...this.state[key], value]
    } else if (
      typeof this.state[key] === 'object' &&
      this.state[key] !== null
    ) {
      this.state[key] = {
        ...this.state[key],
        ...value,
      }
    }
  }

  public get(key: string) {
    return this.state[key]
  }
}
