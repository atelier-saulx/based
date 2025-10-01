import {
  type PromptGroup,
  cancel,
  group,
  isCancel,
  log,
  multiselect,
  select,
  text,
} from '@clack/prompts'
import type { AppContext } from '../context/index.js'

type Validate = (value: string | string[]) => string | undefined

type FieldOption = {
  value: string
  label: string
  hint?: string
}

type Validation =
  | {
      validation?: undefined
    }
  | {
      validation: Validate[]
    }

type Field = Validation & {
  message: string
  required?: boolean
}

type TextField = Field & {
  placeholder?: string
  input?: string
  skip?: boolean
}

type SelectField = Field & {
  input?: string
  options: FieldOption[]
}

type MultiSelectField = Field & {
  input: string[]
  skip?: boolean
  options: FieldOption[]
}

type FormMaker = {
  group?: <T extends Record<string, unknown>>(
    fields: T & {
      header?: string
      footer?: string
      cancelMessage?: string
    },
  ) => Promise<Record<string, object>>
  text?: (field: TextField) => Promise<string>
  normalizeOptions: (
    values: unknown[],
    nameKey?: string,
    valueKey?: string | 'object',
  ) => FieldOption[]
  boolean?: <T>(message?: string) => Promise<boolean | T>
  select?: <T>(field: SelectField) => Promise<string | T>
  multiSelect?: (field: MultiSelectField) => Promise<unknown[]>
  collider: Collider
}

type Validator = (
  input: string | string[],
  validation: Validate[],
  skip: boolean,
) => string | undefined

type Collider = (
  validation: (value: string | string[]) => boolean | Promise<boolean>,
  output: string | ((error: string) => string),
) => (value: string) => string | undefined

export type FormResult = { results: { [key: string]: string } }

const validator: Validator = (input, validation, skip) => {
  if (skip && typeof input === 'string' && !input) {
    return
  }

  const result: string[] = []

  if (validation) {
    for (const validate of validation) {
      const validation = validate(input)

      if (validation) {
        result.push(validation)
      }
    }
  }

  if (!result.length) {
    return
  }

  if (result.length === 1) {
    return result.toString()
  }

  if (result.length > 1) {
    return result.join(' | ')
  }
}

const collider: Collider = (validation, output) => (value) => {
  const isValid = validation(value)

  if (!isValid) {
    if (typeof output === 'string') {
      return output
    }

    return output(value)
  }

  return
}

const errorMessage = (content: string) => {
  cancel(`●  ${content}`)

  process.exit(0)
}

export function contextForm(context: AppContext): FormMaker {
  return {
    collider,
    group: async (fields) => {
      const { header, footer, cancelMessage, ...rest } = fields

      if (header) {
        context.print.intro(header)
      }

      const result = await group(rest as PromptGroup<unknown>, {
        onCancel: () =>
          errorMessage(cancelMessage ?? context.i18n('methods.aborted')),
      })

      if (footer) {
        context.print.outro(footer)
      }

      return result as Promise<Record<string, object>>
    },

    text: async ({
      input,
      message,
      validation,
      skip,
      placeholder,
      required,
    }) => {
      if (input) {
        const validationResult = validator(input, validation, skip)
        const isValid = typeof validationResult === 'undefined'

        if (isValid) {
          return input
        }

        if (!isValid && required) {
          log.error(validationResult)
        }
      }

      if (!input && !required) {
        return ''
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }

      const result = (await text({
        message,
        placeholder,
        initialValue: input,
        validate: (input) => validator(input, validation, skip),
      })) as string

      if (isCancel(result)) {
        return errorMessage(context.i18n('methods.aborted'))
      }

      if (!result || skip) {
        return ''
      }

      return result
    },

    normalizeOptions: (values, labelKey = '', valueKey = '') => {
      if (!values || !values.length) {
        return []
      }

      return values.map((value) => {
        if (typeof value === 'string') {
          return {
            label: value,
            value,
          }
        }

        if (!labelKey || !valueKey) {
          return {
            label: '<empty>',
            value: '<empty>',
          }
        }

        return {
          label: value[labelKey],
          value: valueKey === 'object' ? value : value[valueKey],
        }
      })
    },

    boolean: async (message) => {
      if (!message) {
        message = context.i18n('context.input.continue')
      }

      const options = [
        {
          label: context.i18n('context.input.positive'),
          value: true,
        },
        {
          label: context.i18n('context.input.negative'),
          value: false,
        },
      ]

      const result = (await select({
        message,
        options,
      })) as boolean

      if (isCancel(result)) {
        return errorMessage(context.i18n('methods.aborted'))
      }

      if (result) {
        return true
      }

      return false
    },

    select: async ({ message, options, input, validation, required }) => {
      if (input) {
        const validationResult = validator(input, validation, false)

        if (typeof validationResult === 'undefined') {
          return input
        }

        if (typeof validationResult === 'string') {
          log.error(validationResult)
        }
      }

      if (!input && !required) {
        return ''
      }

      const result = (await select({
        message,
        options,
      })) as string

      if (isCancel(result)) {
        return errorMessage(context.i18n('methods.aborted'))
      }

      return result
    },

    multiSelect: async ({
      message,
      options,
      input,
      skip,
      validation,
      required,
    }) => {
      if (input) {
        const validationResult = validator(input, validation, false)

        if (typeof validationResult === 'undefined' && !required) {
          return input
        }

        if (typeof validationResult === 'string') {
          log.error(validationResult)
        }
      }

      if (!input && !required) {
        return []
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.enterToSkip')}`
      }

      const result = (await multiselect({
        message,
        options,
        initialValues: input,
        required: !skip,
      })) as unknown[]

      if (isCancel(result)) {
        return errorMessage(context.i18n('methods.aborted'))
      }

      return result
    },
  }
}
