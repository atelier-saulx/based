import { checkbox, input, Separator } from '@inquirer/prompts'
import { isValid } from 'date-fns/isValid'
import { parse } from 'date-fns'

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

type MultipleItems =
  | {
      name?: string
      value: string
    }
  | Separator

export const multiSelectInput = async (
  message: string,
  data: MultipleItems[],
  separator: boolean = true,
) => {
  if (data.length > 5 || separator) {
    data.push(new Separator())
  }

  return checkbox({
    message,
    choices: data,
    required: true,
  })
}
