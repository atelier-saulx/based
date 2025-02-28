import { i18n } from '@based/i18n'
import type { Command } from 'commander'
import type { languages } from '../i18n/index.js'
import {
  contextBasedClient,
  contextBasedServer,
  contextCommandMaker,
  contextForm,
  contextGlobalOptions,
  contextInput,
  contextParse,
  contextPrint,
  contextProgram,
  contextRestRequester,
  contextSpinner,
  contextTerminalKit,
  endpoints,
} from './index.js'
// TODO
// We need an eventEmitter?
// import EventEmitter from 'events'
// import '../helpers/context/eventEmitter.js'

export class AppContext {
  private static instance: AppContext
  private logLevels: string[] = [
    'verbose',
    'info',
    'success',
    'warning',
    'error',
    'silent',
  ]
  public state: Based.Context.State = {
    display: 'info',
    emojis: {
      info: '<primary>●</primary>',
      success: '<green>♥</green>',
      warning: '<yellow>▲</yellow>',
      error: '<red>■</red>',
      pipe: '<gray>│</gray>',
    },
  }
  public program: Command
  public i18n: ReturnType<typeof i18n<typeof languages>>
  public commandMaker = contextCommandMaker
  public getGlobalOptions = contextGlobalOptions
  public getProgram = contextProgram
  public getBasedClient = contextBasedClient
  public terminalKit = contextTerminalKit
  public requester = contextRestRequester(this)
  public parse = contextParse
  public input = contextInput(this)
  public form = contextForm(this)
  public print = contextPrint(this)
  public spinner = contextSpinner(this)
  // public event: EventEmitter = eventEmitter
  public endpoints = endpoints
  public basedServer = contextBasedServer(this)

  private constructor(
    program?: Command,
    internationalization?: typeof languages,
  ) {
    if (!program && !this.program) {
      throw new Error('Program must be provided.')
    }

    if (program && !this.program) {
      this.program = program
    }

    if (internationalization) {
      const defaultLanguage = internationalization.default || 'en'

      this.set('languages', internationalization.languages)
      this.set('language', defaultLanguage)

      this.i18n = i18n(internationalization)
    }
  }

  public static getInstance(
    program?: Command,
    i18n?: typeof languages,
  ): AppContext {
    if (!AppContext.instance) {
      AppContext.instance = new AppContext(program, i18n)
    }

    return AppContext.instance
  }

  public set(key: string, value: unknown) {
    this.state[key] = value
  }

  public put(key: string, value: unknown) {
    if (Array.isArray(this.state[key])) {
      this.state[key] = [...this.state[key], value]
    } else if (
      typeof this.state[key] === 'object' &&
      typeof value === 'object' &&
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
