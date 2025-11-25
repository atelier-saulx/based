import { ClientAuthState as AuthState } from '../types/index.js'
import { createEncoder, encodeBase64, decodeBase64 } from '../../utils/index.js'

export const decodeAuthState = (authState: string): AuthState => {
  try {
    const str = new TextDecoder().decode(decodeBase64(decode(authState)))
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

const { encode, decode } = createEncoder(
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

export const encodeAuthState = (authState: AuthState): string => {
  // CLIENT VERSION
  authState.v = 2
  return encode(
    encodeBase64(new TextEncoder().encode(JSON.stringify(authState))),
  )
}
