import { checkbox, input, select, Separator } from '@inquirer/prompts'
import { isValid } from 'date-fns/isValid'
import { parse } from 'date-fns'
import confirm from '@inquirer/confirm'

export const dateInput = async (message: string, skip: boolean = true) =>
  input({
    message,
    validate: (value) =>
      (skip && value === 's') ||
      isValid(parse(value, 'dd/MM/yyyy', new Date())),
  })

export const numberInput = async (message: string, skip: boolean = true) =>
  input({
    message,
    required: true,
    validate: (value) => (skip && value === 's') || !isNaN(Number(value)),
  })

export const emailInput = async (message: string) =>
  input({
    message,
    required: true,
    validate: (email) => {
      const at: number = email.lastIndexOf('@')
      const dot: number = email.lastIndexOf('.')

      return at > 0 && at < dot - 1 && dot < email.length - 2
    },
  })

export const confirmInput = async (
  message: string = 'Continue?',
  defaultValue: boolean = true,
) =>
  confirm({
    message,
    default: defaultValue,
  })

export const defaultInput = async (
  message: string,
  defaultValue: string,
  validate?: (value: string) => boolean | string | Promise<string | boolean>,
) =>
  input({
    message,
    required: true,
    default: defaultValue,
    validate,
  })

export type SelectInputItems =
  | {
      name?: string
      value: any
    }
  | Separator

export const multiSelectInput = async (
  message: string,
  choices: SelectInputItems[],
  separator: boolean = true,
) => {
  if (choices.length > 5 || separator) {
    choices.push(new Separator())
  }

  return checkbox({
    message,
    choices,
    required: true,
  })
}

export const singleSelectInput = async (
  message: string,
  choices: SelectInputItems[],
  separator: boolean = true,
) => {
  if (choices.length > 5 || separator) {
    choices.push(new Separator())
  }

  return select({
    message,
    choices,
  })
}
