export enum ParseError {
  'incorrectFieldType',
  'incorrectNodeType',
  'exceedsMaximum',
  'subceedsMinimum',
  'fieldDoesNotExist',
  'incorrectFormat',
}

export const error = (path: (number | string)[], error: ParseError) => {
  throw new Error(`Type:  Field: "${path.join('.')}" ${ParseError[error]}`)
}
