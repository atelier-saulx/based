import { BasedSetHandlers } from '../types'

export enum ParseError {
  'incorrectFieldType',
  'incorrectNodeType',
  'exceedsMaximum',
  'subceedsMinimum',
  'fieldDoesNotExist',
  'incorrectFormat',
  'referenceIsIncorrectType',
  'valueAndDefault',
  'defaultNotSupported',
  'multipleOperationsNotAllowed',
  'requiredFieldNotDefined',
  'languageNotSupported',
  'invalidJSON',
}

export const error = (
  handlers: BasedSetHandlers,
  error: ParseError,
  path?: (number | string)[]
) => {
  const message = path
    ? `${ParseError[error]} ${path.join('.')}`
    : `${ParseError[error]}`

  handlers.collectErrors({
    message,
    code: error,
  })
}
