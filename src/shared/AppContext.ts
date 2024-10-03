import { spinner } from './spinner.js'
import { parseMessage } from './parseMessage.js'
import { checkbox, input, select, Separator } from '@inquirer/prompts'
import { isValid } from 'date-fns/isValid'
import { format as formatDate, parse } from 'date-fns'
import confirm from '@inquirer/confirm'
import { dateAndTime, dateOnly } from './dateAndTimeFormats.js'
import { Command } from 'commander'
import { getBasedFile } from './getBasedFile.js'
import { login } from './login.js'

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

  public getGlobalOptions(): BasedCli.Context.GlobalOptions<'skip'> {
    let globalOptions: BasedCli.Context.GlobalOptions<'skip'> =
      this.get('globalOptions')

    const { yes: skip, display } =
      this.program.opts() as BasedCli.Context.GlobalOptions<'yes'>

    globalOptions = {
      ...globalOptions,
      ...(skip && { skip }),
      ...(display && { display }),
    }

    this.set('globalOptions', globalOptions)

    return globalOptions
  }

  public async getBasedClient(): Promise<BasedCli.Auth.Clients> {
    const basedProject: BasedCli.Context.Project = this.get('basedProject')
    let basedClients: BasedCli.Auth.Clients = this.get('basedClients')

    if (!basedClients) {
      basedClients = await login({
        ...basedProject,
        context: this,
      })

      if (
        !basedClients.basedClient ||
        !basedClients.adminHubBasedCloud ||
        !basedClients.envHubBasedCloud
      ) {
        throw new Error(
          `Fatal error during <b>authorization</b>. Check your <b>'based.json'</b> file or <b>your arguments</b> and try again.`,
        )
      }
    }

    const { basedClient, adminHubBasedCloud, envHubBasedCloud, destroy } =
      basedClients

    basedClients = {
      ...basedClients,
      ...(basedClient && { basedClient }),
      ...(adminHubBasedCloud && { adminHubBasedCloud }),
      ...(envHubBasedCloud && { envHubBasedCloud }),
      ...(destroy && { destroy }),
    }

    this.set('basedClients', basedClients)

    return basedClients
  }

  public async getProgram(): Promise<BasedCli.Context.Project> {
    let basedProject: BasedCli.Context.Project = this.get('basedProject')
    let basedFile: BasedCli.Context.Project = {}

    if (basedProject) {
      return basedProject
    }

    const { cluster, org, project, env, apiKey } =
      this.program.opts() as BasedCli.Context.Project

    if (!basedProject) {
      basedFile = await getBasedFile()

      if (!basedFile || !Object.keys(basedFile)?.length) {
        this.print.warning(
          `No <b>'based.json'</b> configuration file found. <b>It is recommended to create one.</b>`,
        )
      }
    }

    basedProject = {
      ...basedFile,
      ...(cluster && { cluster }),
      ...(org && { org }),
      ...(project && { project }),
      ...(env && { env }),
      ...(apiKey && { apiKey }),
    }

    this.set('basedProject', basedProject)

    this.print
      .info(`<dim>org:</dim> <b>${basedProject.org}</b>`)
      .info(`<dim>project:</dim> <b>${basedProject.project}</b>`)
      .info(`<dim>env:</dim> <b>${basedProject.env}</b>`)

    return basedProject
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
