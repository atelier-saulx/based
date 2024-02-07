export type BasedError = {
  code: ParseErrors
  payload: any
}

export type BasedParseError = {
  code: ParseErrors
  path: string[]
}

export type BasedMutationError = {
  code: MutationErrors
  path: string[]
  payload: { [key: string]: any }
}
export enum ParseErrors {
  // Parse Errors
  'incorrectFieldType' = 1000,
  'incorrectNodeType' = 1001,
  'exceedsMaximum' = 1002,
  'subceedsMinimum' = 1003,
  'fieldDoesNotExist' = 1004,
  'incorrectFormat' = 1005,
  'referenceIsIncorrectType' = 1006,
  'valueAndDefault' = 1007,
  'defaultNotSupported' = 1008,
  'multipleOperationsNotAllowed' = 1009,
  'requiredFieldNotDefined' = 1010,
  'languageNotSupported' = 1011,
  'invalidJSON' = 1012,
  'noLanguageFound' = 1013,
  'cannotDeleteNodeFromModify' = 1014,
  'nestedModifyObjectNotAllowed' = 1015,
  'infinityNotSupported' = 1016,
  'invalidSchemaFormat' = 1017,
  'invalidProperty' = 1018,

  // Mutation error
  'PrefixAlreadyInUse' = 2000,
}
export enum MutationErrors {
  'PrefixAlreadyInUse' = 2000,
}

export const errorDescriptions: {
  [key in ParseErrors]: string | ((payload: { [key: string]: any }) => string)
} = {
  [ParseErrors.incorrectFieldType]: 'Incorrect field type.',
  [ParseErrors.incorrectNodeType]: 'Incorrect node type.',
  [ParseErrors.exceedsMaximum]: 'Exceeds maximum property.',
  [ParseErrors.subceedsMinimum]: 'Subceeds minimum property.',
  [ParseErrors.fieldDoesNotExist]: 'Field does not exist.',
  [ParseErrors.incorrectFormat]: 'Incorrect format.',
  [ParseErrors.referenceIsIncorrectType]: 'Reference is from incorrect type.',
  [ParseErrors.valueAndDefault]:
    'Value and $default are being used at the same time.',
  [ParseErrors.defaultNotSupported]: '$default is not suported.',
  [ParseErrors.multipleOperationsNotAllowed]:
    'Multiple operations are not allowed here.',
  [ParseErrors.requiredFieldNotDefined]: 'Required field is not defined.',
  [ParseErrors.languageNotSupported]: 'Language not supported.',
  [ParseErrors.invalidJSON]: 'Invalid JSON.',
  [ParseErrors.noLanguageFound]: 'No language found.',
  [ParseErrors.cannotDeleteNodeFromModify]: 'Cannot delete node from modify.',
  [ParseErrors.nestedModifyObjectNotAllowed]:
    'Nested modify object not allowed.',
  [ParseErrors.infinityNotSupported]: 'Infinity not supported.',
  [ParseErrors.invalidSchemaFormat]: 'Invalid schema format.',
  [ParseErrors.invalidProperty]: 'Invalid property.',

  [ParseErrors.PrefixAlreadyInUse]: (payload) =>
    `Prefix${payload?.prefix ? ` ${payload.prefix}` : ''} is already in use.`,
}

export const makeError = (code: ParseErrors, payload: any) => ({
  code,
  payload,
})

export const makeErrorMessage = (error: BasedError): string => {
  if (!errorDescriptions[error.code]) {
    return `Uknown error: ${error}`
  }

  if (typeof errorDescriptions[error.code] === 'function') {
    return (errorDescriptions[error.code] as Function)(error.payload)
  }
  return errorDescriptions[error.code] as string
}

export class BasedException extends Error {
  public code: ParseErrors
  public payload: any

  constructor(error: BasedError) {
    super(makeErrorMessage(error))
    this.code = error.code
    this.payload = error.payload
  }
}

export const makeException = (error: BasedError) => new BasedException(error)
