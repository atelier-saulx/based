import { Separator, checkbox, confirm, input, select } from '@inquirer/prompts'
import { isValid, parse } from 'date-fns'
import {
  type AppContext,
  colorize,
  dateAndTime,
  dateOnly,
} from '../../shared/index.js'
import { contextParse } from './parse.js'

export function contextInput(context: AppContext): Based.Context.InputHandler {
  return {
    date: async (
      message: string,
      skip: boolean = true,
      today: boolean = true,
      format: string = dateOnly,
    ) => {
      message = `${message} <b>(${format.toUpperCase()})</b>`

      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }
      if (today) {
        message = `${message} ${context.i18n('context.input.today')}`
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

    dateTime: async (
      message: string,
      skip: boolean = true,
      now: boolean = true,
      format: string = dateAndTime,
    ) => {
      message = `${message} <b>(${format.toUpperCase()})</b>`

      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }
      if (now) {
        message = `${message} ${context.i18n('context.input.now')}`
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

    number: async (message: string, skip: boolean = true) => {
      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }

      const prompt = input({
        message: colorize(message),
        required: true,
        validate: (value) =>
          (skip && value === 's') || !Number.isNaN(Number(value)),
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

    confirm: async (
      message: string = context.i18n('context.input.continue'),
      defaultValue: boolean = true,
    ) =>
      confirm({
        message: colorize(message),
        default: defaultValue,
      }),

    default: async (
      message: string,
      defaultValue: string = '',
      skip: boolean = false,
      validate?: (
        value: string,
      ) => boolean | string | Promise<string | boolean>,
    ) => {
      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }

      return input({
        message: colorize(message),
        required: true,
        default: defaultValue,
        validate: (value) => {
          if (!validate) {
            return true
          }

          if (skip && value === 's') {
            return true
          }

          return validate(value)
        },
      })
    },

    select: async (
      message: string,
      choices: Based.Context.SelectInputItems[],
      multiSelection: boolean = false,
      separator: boolean = true,
    ) => {
      if (!choices || !choices.length) {
        return
      }

      if (choices && choices.length > 5 && separator) {
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
          message: `${colorize(message)}:`,
          choices,
          required: true,
        })
      }

      return select({
        message: `${colorize(message)}:`,
        choices,
      })
    },
  }
}
