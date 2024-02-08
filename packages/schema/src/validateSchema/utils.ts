import { ParseError } from '../error.js'

export const mustBeString = (value: string, path: string[]) =>
  typeof value === 'string'
    ? []
    : [
        {
          code: ParseError.incorrectFormat,
          path,
        },
      ]

export const mustBeStringArray = (value: string[], path: string[]) =>
  Array.isArray(value) && value.every((i) => typeof i === 'string')
    ? []
    : [
        {
          code: ParseError.incorrectFormat,
          path,
        },
      ]

export const mustBeBoolean = (value: string, path: string[]) =>
  typeof value === 'boolean'
    ? []
    : [
        {
          code: ParseError.incorrectFormat,
          path,
        },
      ]

export const mustBeNumber = (value: string, path: string[]) =>
  typeof value === 'number'
    ? []
    : [
        {
          code: ParseError.incorrectFormat,
          path,
        },
      ]

export const mustBeBidirectional = (value: any, path: string[]) => {
  if (!(typeof value === 'object' && !Array.isArray(value))) {
    return [
      {
        code: ParseError.incorrectFormat,
        path,
      },
    ]
  }
  return value.hasOwnProperty('fromField') &&
    typeof value.fromField === 'string'
    ? []
    : [
        {
          code: ParseError.incorrectFormat,
          path: path.concat('fromField'),
        },
      ]
}
