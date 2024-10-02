import { spinner } from './spinner.js'
import { parseMessage } from './parseMessage.js'
import { checkbox, input, select, Separator } from '@inquirer/prompts'
import { isValid } from 'date-fns/isValid'
import { format as formatDate, parse } from 'date-fns'
import confirm from '@inquirer/confirm'
import { dateAndTime, dateOnly } from './dateAndTimeFormats.js'
import { Command } from 'commander'
import { getBasedFile } from './getBasedFile.js'

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

  public async getProgram(): Promise<
    BasedCli.Context.Project & BasedCli.Context.Options
  > {
    let basedFile: BasedCli.Context.Project
    const cacheProject: BasedCli.Context.Project = this.get('project')
    const cacheOptions: BasedCli.Context.Options = this.get('options')
    const {
      cluster,
      org,
      project,
      env,
      apiKey,
      yes: skip,
      display,
    } = this.program.opts()

    if (cluster || org || project || env) {
      this.set('project', {
        ...cacheProject,
        cluster,
        org,
        project,
        env,
        apiKey,
      })
    }

    if (skip || display) {
      this.set('options', {
        ...cacheOptions,
        skip,
        display,
      })
    }

    if (!cacheProject) {
      basedFile = await getBasedFile()

      if (!basedFile) {
        this.print.warning(
          `No <b>'based.json'</b> configuration file found. <b>It is recommended to create one.</b>`,
        )
      } else {
        this.set('project', basedFile)
      }
    }

    this.print
      .info(`<dim>org:</dim> <b>${basedFile.org}</b>`)
      .info(`<dim>project:</dim> <b>${basedFile.project}</b>`)
      .info(`<dim>env:</dim> <b>${basedFile.env}</b>`)

    return { ...this.get('project'), ...this.get('options') }
  }

  public parse: BasedCli.Context.Parse = {
    date: (
      value: string | Date,
      formatIN: string | undefined = dateOnly,
      formatOUT: string = dateOnly,
    ) => {
      let date: Date = new Date()

      if (typeof value === 'string') {
        date = parse(value, formatIN, new Date())
        value = formatDate(date, formatOUT)
      } else {
        value = formatDate(value, formatOUT)
      }

      return {
        value,
        date,
        timestamp: date.getTime(),
      }
    },
  }

  public input: BasedCli.Context.InputHandler = {
    date: async (
      message: string,
      skip: boolean = true,
      today: boolean = true,
      format: string = dateOnly,
    ) => {
      message = message + ` <b>(${format.toUpperCase()})</b>`

      if (skip) {
        message = message + ' <dim>(S to skip)</dim>'
      }
      if (today) {
        message = message + ' <dim>(T for today)</dim>'
      }

      const value: string = await input({
        message: parseMessage(message),
        validate: (value) =>
          (skip && value.toLowerCase() === 's') ||
          (today && value.toLowerCase() === 't') ||
          isValid(parse(value, format, new Date())),
      })

      if (today && value === 't') {
        return this.parse.date(new Date().getTime().toString())
      }

      if (value === 's') {
        return null
      }

      return this.parse.date(value)
    },
    dateTime: async (
      message: string,
      skip: boolean = true,
      now: boolean = true,
      format: string = dateAndTime,
    ) => {
      message = message + ` <b>(${format.toUpperCase()})</b>`

      if (skip) {
        message = message + ' <dim>(S to skip)</dim>'
      }
      if (now) {
        message = message + ' <dim>(N for now)</dim>'
      }

      const value = await input({
        message: parseMessage(message),
        validate: (value) =>
          (skip && value.toLowerCase() === 's') ||
          (now && value.toLowerCase() === 'n') ||
          isValid(parse(value, format, new Date())),
      })

      if (now && value === 'n') {
        return this.parse.date(
          new Date().getTime().toString(),
          dateAndTime,
          dateAndTime,
        )
      }

      if (value === 's') {
        return null
      }

      return this.parse.date(value, dateAndTime, dateAndTime)
    },
    number: async (message: string, skip: boolean = true) => {
      if (skip) {
        message = message + ' <dim>(S to skip)</dim>'
      }

      const prompt = input({
        message: parseMessage(message),
        required: true,
        validate: (value) => (skip && value === 's') || !isNaN(Number(value)),
      })

      if ((await prompt) === 's') {
        return null
      }

      return prompt
    },
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
      choices: BasedCli.Context.SelectInputItems[],
      multiSelection: boolean = false,
      separator: boolean = true,
    ) => {
      if (choices.length > 5 && separator) {
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

  public print: BasedCli.Context.MessageHandler = {
    loading: (message: string): BasedCli.Context.MessageHandler => {
      if (
        this.state.display === 'verbose' ||
        this.state.display === 'info' ||
        this.state.display === 'success'
      ) {
        spinner.start(parseMessage(message))
      }

      return this.print
    },
    stop: (): BasedCli.Context.MessageHandler => {
      spinner.stop()

      return this.print
    },
    info: (
      message: string,
      icon: boolean | string = false,
    ): BasedCli.Context.MessageHandler => {
      if (this.state.display === 'verbose' || this.state.display === 'info') {
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
    ): BasedCli.Context.MessageHandler => {
      if (
        this.state.display === 'verbose' ||
        this.state.display === 'success'
      ) {
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
    ): BasedCli.Context.MessageHandler => {
      if (
        this.state.display === 'verbose' ||
        this.state.display === 'warning'
      ) {
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
      if (this.state.display === 'verbose' || this.state.display === 'error') {
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
    line: (): BasedCli.Context.MessageHandler => {
      if (this.state.display === 'silent') {
        return this.print
      }

      console.info('')

      return this.print
    },
    separator: (
      width: number = process.stdout.columns,
    ): BasedCli.Context.MessageHandler => {
      if (this.state.display === 'silent') {
        return this.print
      }

      console.info(parseMessage('<gray>─</gray>').repeat(width))

      return this.print
    },
  }
}
