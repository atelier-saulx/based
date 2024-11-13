import {
  type PromptGroup,
  cancel,
  group,
  intro,
  log,
  multiselect,
  select,
  text,
} from '@clack/prompts'
import { type AppContext, colorize } from '../../shared/index.js'

type Validate = (value: string | string[]) => boolean

type FieldOption = {
  value: string
  label: string
  hint?: string
}

type Validation =
  | {
      errorMessage?: undefined
      validation?: undefined
    }
  | {
      errorMessage: string | ((error: string) => string)
      validation: Validate
    }

type Field = Validation & {
  message: string
  required?: boolean
}

type TextField = Field & {
  placeholder?: string
  initialValue?: string
  skip?: boolean
}

type SelectField = Field & {
  initialValue?: string
  options: FieldOption[]
}

type MultiSelectField = SelectField & {
  initialValues: string[]
  skip?: boolean
}

type FormMaker = {
  group?: <T extends Record<string, unknown>>(
    fields: T & {
      header?: string
      cancelMessage?: string
    },
  ) => ReturnType<typeof group>
  text?: (field: TextField) => Promise<string>
  select?: (field: SelectField) => Promise<string>
  multiSelect?: (field: MultiSelectField) => Promise<unknown[]>
}

const initialValidation = (
  value: string | string[],
  required: boolean,
  validation: (value: string | string[]) => boolean,
  errorMessage: string | ((value: string) => string),
): boolean => {
  if (value?.length && !validation(value)) {
    if (required) {
      if (typeof errorMessage === 'string') {
        log.error(colorize(errorMessage))
      } else {
        if (typeof value === 'string') {
          log.error(colorize(errorMessage(value)))
        } else {
          log.error(colorize(errorMessage(value.join(','))))
        }
      }
    }

    return false
  }

  if (value?.length && validation(value)) {
    return true
  }
}

export function contextForm(context: AppContext): FormMaker {
  return {
    group: async (fields) => {
      const { header, cancelMessage, ...rest } = fields

      if (header) {
        console.log('')
        intro(colorize(header))
      }

      return group(rest as PromptGroup<unknown>, {
        onCancel: () => {
          cancel(cancelMessage ?? context.i18n('methods.aborted'))

          process.exit(0)
        },
      })
    },

    text: async ({
      initialValue,
      message,
      validation,
      errorMessage,
      skip,
      placeholder,
      required,
    }) => {
      if (initialValidation(initialValue, required, validation, errorMessage)) {
        return initialValue
      }

      if (!required) {
        return ''
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }

      return (await text({
        message: colorize(message),
        placeholder,
        initialValue,
        validate: (value) => {
          if (skip && value.toLowerCase() === 's') {
            return
          }

          if (!validation(value)) {
            if (typeof errorMessage === 'string') {
              return colorize(errorMessage)
            }

            return colorize(errorMessage(value))
          }
        },
      })) as string
    },

    select: async ({
      message,
      options,
      initialValue,
      validation,
      errorMessage,
      required,
    }) => {
      if (initialValidation(initialValue, required, validation, errorMessage)) {
        return initialValue
      }

      if (!required) {
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
      initialValues,
      skip,
      validation,
      errorMessage,
      required,
    }) => {
      if (
        initialValidation(initialValues, required, validation, errorMessage)
      ) {
        return initialValues
      }

      if (!required) {
        return []
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.enterToSkip')}`
      }

      return (await multiselect({
        message: colorize(message),
        options,
        initialValues,
        required: !skip,
      })) as unknown[]
    },
  }
}
