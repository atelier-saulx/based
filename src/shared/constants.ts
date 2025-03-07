import { homedir } from 'node:os'
import { join } from 'node:path'

export const SPACER = '  '
export const NUMBER_ZERO = 48
export const NUMBER_NINE = 57
export const LETTER_UPPER_A = 65
export const LETTER_UPPER_Z = 90
export const LETTER_LOWER_A = 97
export const LETTER_LOWER_Z = 122
export const LINE_NEW = '\n'
export const LINE_START = '\r'
export const LINE_CLEAR = '\x1b[2K'
export const LINE_UP = '\x1b[F'
export const LINE_DOWN = '\x1b[E'
export const INTERNAL_PATH: string = join(homedir(), '.based/cli')
export const LOCAL_AUTH_INFO: string = join(
  INTERNAL_PATH as string,
  'auth.json',
)
export const CONNECTION_TIMEOUT: number = 120e3
export const isValidChar = (char: number) => {
  return (
    (char >= NUMBER_ZERO && char <= NUMBER_NINE) ||
    (char >= LETTER_UPPER_A && char <= LETTER_UPPER_Z) ||
    (char >= LETTER_LOWER_A && char <= LETTER_LOWER_Z)
  )
}
export const FUNCTION_TYPES = {
  query: 'BasedQueryFunction',
  function: 'BasedFunction',
  app: 'BasedAppFunction',
}
