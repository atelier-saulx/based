import { input, confirm, Separator, checkbox, select } from '@inquirer/prompts'
import { dateAndTime, dateOnly, parseMessage } from '../../shared/index.js'
import { isValid, parse } from 'date-fns'
import { contextParse } from './parse.js'

export const contextInput: Based.Context.InputHandler = {
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
      return contextParse.date(new Date().getTime().toString())
    }

    if (value === 's') {
      return null
    }

    return contextParse.date(value)
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
      return contextParse.date(
        new Date().getTime().toString(),
        dateAndTime,
        dateAndTime,
      )
    }

    if (value === 's') {
      return null
    }

    return contextParse.date(value, dateAndTime, dateAndTime)
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
    validate?: (value: string) => boolean | string | Promise<string | boolean>,
  ) =>
    input({
      message: parseMessage(message),
      required: true,
      default: defaultValue,
      validate,
    }),

  select: async (
    message: string,
    choices: Based.Context.SelectInputItems[],
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
