import { AuthState } from '../types/index.js'
import { createEncoder } from '@saulx/utils'

export const decodeAuthState = (authState: string): AuthState => {
  try {
    const str = global.atob(decodeURI(authState))
    return JSON.parse(str)
  } catch (err) {
    return { error: 'Invalid authState' }
  }
}

/*
  Websocket Protocol
      token          = 1*<any CHAR except CTLs or separators>
      separators     = "(" | ")" | "<" | ">" | "@"
                    | "," | ";" | ":" | "\" | <">
                    | "/" | "[" | "]" | "?" | "="
                    | "{" | "}" | SP | HT 
      exclude " | '
*/
// | HT (what is this?)

// can also encode the json - no base64

const { encode } = createEncoder(
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
  ['0']
)

export const encodeAuthState = (authState: AuthState): string => {
  return encodeURI(encode(global.btoa(JSON.stringify(authState))))
}
