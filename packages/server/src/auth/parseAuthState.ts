import { AuthState } from '@based/functions'
import { createEncoder } from '@saulx/utils'

const { decode } = createEncoder(
  [
    '(',
    ')',
    '<',
    '>',
    '@',
    ',',
    ';',
    ':',
    '\\',
    '"',
    '/',
    '[',
    ']',
    '?',
    '=',
    '{',
    '}',
    ' ',
  ],
  ['0'],
)

export default (authState: any): AuthState => {
  if (authState === undefined) {
    return {}
  }
  if (typeof authState !== 'string') {
    return { error: 'Invalid token' }
  }
  try {
    return JSON.parse(
      Buffer.from(decode(decodeURI(authState)), 'base64').toString('utf8'),
    )
  } catch (err) {
    return { error: 'Invalid token' }
  }
}
