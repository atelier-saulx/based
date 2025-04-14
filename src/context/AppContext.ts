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

export class AppContext {
  public program: Command
  private static instance: AppContext
  public state: Based.Context.State = {
    emojis: {
      intro: '<gray>┌</gray>',
      outro: '<gray>└</gray>',
      step: '<primary>●</primary>',
      line: '<gray>──</gray>',
      pipe: '<gray>│</gray>',
      log: '<white>◇</white>',
      success: '<green>●</green>',
      error: '<red>■</red>',
      warning: '<yellow>▲</yellow>',
      spinner: [
        '<primary>◐</primary>',
        '<primary>◓</primary>',
        '<primary>◑</primary>',
        '<primary>◒</primary>',
      ],
    },
  }
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
    if (!this.state[key]) {
      this.set(key, value)
    } else {
      if (Array.isArray(this.state[key])) {
        if (!Array.isArray(value)) {
          this.state[key] = [...this.state[key], value]
        } else {
          this.state[key] = [...this.state[key], ...value]
        }
      } else if (typeof this.state[key] === 'object') {
        if (typeof value === 'object') {
          this.state[key] = {
            ...this.state[key],
            ...value,
          }
        } else {
          throw new Error(
            "You're trying to add a non-object value into an object.",
          )
        }
      } else {
        this.state[key] = value
      }
    }
  }

  public get(key: string) {
    return this.state[key]
  }
}
