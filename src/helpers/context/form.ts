import { group, log, multiselect, select, text } from '@clack/prompts'
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
  placeholder?: string
}

type TextField = Field & {
  initialValue?: string
  skip?: boolean
}

type SelectField = Field & {
  options: FieldOption[]
}

type MultiSelectField = SelectField & {
  initialValues: string[]
  skip?: boolean
}

type FormMaker = {
  group?: typeof group
  text?: (field: TextField) => Promise<string>
  select?: typeof select
  multiSelect?: (field: MultiSelectField) => Promise<unknown[]>
}

export function contextForm(context: AppContext): FormMaker {
  return {
    group: async (fields) => {
      return group(fields, {
        onCancel: () => process.exit(0),
      })
    },
    text: async ({
      initialValue,
      message,
      validation,
      errorMessage,
      skip,
      placeholder,
    }) => {
      if (initialValue && !validation(initialValue)) {
        if (typeof errorMessage === 'string') {
          log.error(colorize(errorMessage))
        } else {
          log.error(colorize(errorMessage(initialValue)))
        }
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.skip')}`
      }

      return (await text({
        message: colorize(message),
        placeholder,
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
    select,
    multiSelect: async ({
      message,
      options,
      initialValues,
      skip,
      validation,
      errorMessage,
    }) => {
      console.log('initialValues', initialValues)
      if (initialValues && !validation(initialValues)) {
        if (typeof errorMessage === 'string') {
          log.error(colorize(errorMessage))
        } else {
          log.error(colorize(errorMessage(initialValues.join(','))))
        }
      }

      if (skip) {
        message = `${message} ${context.i18n('context.input.enterToSkip')}`
      }

      return (await multiselect({
        message: colorize(message),
        options,
        initialValues,
        required: skip,
      })) as unknown[]
    },
  }
}
