import {
  type PromptGroup,
  cancel,
  group,
  intro,
  log,
  multiselect,
  outro,
  select,
  text,
} from '@clack/prompts'
import { type AppContext, colorize } from '../../shared/index.js'

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
  ) => ReturnType<typeof group>
  text?: (field: TextField) => Promise<string>
  select?: (field: SelectField) => Promise<string>
  multiSelect?: (field: MultiSelectField) => Promise<unknown[]>
}

type Validator = (
  input: string | string[],
  validation: Validate[],
  skip: boolean,
) => string | undefined

export type FormResult = { results: { [key: string]: string } }

const validator: Validator = (input, validation, skip) => {
  if (skip && typeof input === 'string' && input.toLowerCase() === 's') {
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

export function contextForm(context: AppContext): FormMaker {
  return {
    group: async (fields) => {
      const { header, footer, cancelMessage, ...rest } = fields

      if (header) {
        console.log('')
        intro(colorize(header))
      }

      const result = await group(rest as PromptGroup<unknown>, {
        onCancel: () => {
          cancel(`\r●  ${cancelMessage ?? context.i18n('methods.aborted')}`)

          process.exit(0)
        },
      })

      if (footer) {
        outro(colorize(footer))
      }

      return result
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
          log.error(colorize(validationResult))
        }
      }

      if (!input && !required) {
        return ''
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }

      const result = (await text({
        message: colorize(message),
        placeholder,
        initialValue: input,
        validate: (input) => colorize(validator(input, validation, skip)),
      })) as string

      if (!result || (skip && result && result.toLowerCase() === 's')) {
        return ''
      }

      return result
    },

    select: async ({ message, options, input, validation, required }) => {
      if (input) {
        const validationResult = validator(input, validation, false)

        if (typeof validationResult === 'undefined') {
          return input
        }

        if (typeof validationResult === 'string') {
          log.error(colorize(validationResult))
        }
      }

      if (!input && !required) {
        return ''
      }

      return (await select({
        message: colorize(message),
        options,
      })) as string
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

        if (typeof validationResult === 'undefined') {
          return input
        }

        if (typeof validationResult === 'string') {
          log.error(colorize(validationResult))
        }
      }

      if (!input && !required) {
        return []
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.enterToSkip')}`
      }

      return (await multiselect({
        message: colorize(message),
        options,
        initialValues: input,
        required: !skip,
      })) as unknown[]
    },
  }
}
