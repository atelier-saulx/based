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
}

export const error = (
  path: (number | string)[],
  error: ParseError,
  type?: string // nice to give as option
) => {
  throw new Error(`Field: "${path.join('.')}" ${ParseError[error]}`)
}
