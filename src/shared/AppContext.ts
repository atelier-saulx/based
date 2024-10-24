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

  private constructor(
    program?: Command,
    internationalization?: Based.i18n.TranslationsModel,
  ) {
    if (!program && !this.program) {
      throw new Error('Program must be provided.')
    } else if (program && !this.program) {
      this.program = program
    }

    if (internationalization) {
      const defaultLanguage = internationalization.default || 'en'

      this.set('languages', internationalization.languages)
      this.set('language', defaultLanguage)

      this.i18n = i18n(internationalization.languages[defaultLanguage])
    }
  }

  public static getInstance(
    program?: Command,
    languages?: Based.i18n.TranslationsModel,
  ): AppContext {
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

  public i18n: Based.i18n.Translate
  public commandMaker = contextCommandMaker
  public getGlobalOptions = contextGlobalOptions
  public getProgram = contextProgram
  public getBasedClients = contextBasedClients
  public parse = contextParse
  public input = contextInput
  public print = contextPrint(this.state)
}
