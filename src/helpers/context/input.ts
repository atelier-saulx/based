import { input, confirm, Separator, checkbox, select } from '@inquirer/prompts'
import {
  AppContext,
  dateAndTime,
  dateOnly,
  colorize,
} from '../../shared/index.js'
import { isValid, parse } from 'date-fns'
import { contextParse } from './parse.js'

export function contextInput(context: AppContext): Based.Context.InputHandler {
  return {
    date: async function (
      message: string,
      skip: boolean = true,
      today: boolean = true,
      format: string = dateOnly,
    ) {
      message = message + ` <b>(${format.toUpperCase()})</b>`

      if (skip) {
        message = message + ' ' + context.i18n('context.input.skip')
      }
      if (today) {
        message = message + ' ' + context.i18n('context.input.today')
      }

      const value: string = await input({
        message: colorize(message),
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

    dateTime: async function (
      message: string,
      skip: boolean = true,
      now: boolean = true,
      format: string = dateAndTime,
    ) {
      message = message + ` <b>(${format.toUpperCase()})</b>`

      if (skip) {
        message = message + ' ' + context.i18n('context.input.skip')
      }
      if (now) {
        message = message + ' ' + context.i18n('context.input.now')
      }

      const value = await input({
        message: colorize(message),
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

    number: async function (message: string, skip: boolean = true) {
      if (skip) {
        message = message + ' ' + context.i18n('context.input.skip')
      }

      const prompt = input({
        message: colorize(message),
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
        message: colorize(message),
        required: true,
        validate: (email) => {
          const at: number = email.lastIndexOf('@')
          const dot: number = email.lastIndexOf('.')

          return at > 0 && at < dot - 1 && dot < email.length - 2
        },
      }),

    confirm: async function (
      message: string = context.i18n('context.input.continue'),
      defaultValue: boolean = true,
    ) {
      return confirm({
        message: colorize(message),
        default: defaultValue,
      })
    },

    default: async (
      message: string,
      defaultValue: string = '',
      validate?: (
        value: string,
      ) => boolean | string | Promise<string | boolean>,
    ) =>
      input({
        message: colorize(message),
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
          name: colorize(choice.name),
          description: colorize(choice.description),
          value: choice.value,
        }
      })

      if (multiSelection) {
        return checkbox({
          message: colorize(message) + ':',
          choices,
          required: true,
        })
      }

      return select({
        message: colorize(message) + ':',
        choices,
      })
    },
  }
}
