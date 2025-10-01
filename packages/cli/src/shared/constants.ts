import { homedir } from 'node:os'
import { join } from 'node:path'

export const SPACER: string = '  '
export const NUMBER_ZERO: number = 48
export const NUMBER_NINE: number = 57
export const LETTER_UPPER_A: number = 65
export const LETTER_UPPER_Z: number = 90
export const LETTER_LOWER_A: number = 97
export const LETTER_LOWER_Z: number = 122
export const LINE_NEW: string = '\n'
export const LINE_START: string = '\r'
export const LINE_CLEAR: string = '\x1b[2K'
export const LINE_UP: string = '\x1b[F'
export const LINE_DOWN: string = '\x1b[E'
export const INTERNAL_PATH: string = join(homedir(), '.based/cli')
export const LOCAL_AUTH_INFO: string = join(
  INTERNAL_PATH as string,
  'auth.json',
)
export const CONNECTION_TIMEOUT: number = 600e3
export const IS_VALID_CHAR = (char: number): boolean => {
  return (
    (char >= NUMBER_ZERO && char <= NUMBER_NINE) ||
    (char >= LETTER_UPPER_A && char <= LETTER_UPPER_Z) ||
    (char >= LETTER_LOWER_A && char <= LETTER_LOWER_Z)
  )
}
export const FUNCTION_TYPES = {
  authorize: 'Authorize',
  query: 'BasedQueryFunction',
  function: 'BasedFunction',
  app: 'BasedAppFunction',
  stream: 'BasedStreamFunction',
  channel: 'BasedChannelFunction',
  job: 'BasedJobFunction',
  http: 'BasedHttpFunction',
}
export const LIVE_RELOAD_SCRIPT = (port: number): string =>
  `<script>!function e(o){var n=window.location.hostname;o||(o=0),setTimeout((function(){var t=new WebSocket("ws://"+n+":${port}");t.addEventListener("message",(function(){location.reload()})),t.addEventListener("open",(function(){o>0&&location.reload(),console.log("%cBased live reload server connected","color: #bbb")})),t.addEventListener("close",(function(){console.log("%cBased live reload server reconnecting...","color: #bbb"),e(Math.min(o+1e3))}))}),o)}();</script>`
export const BASED_OPTS_SCRIPT = (opts: any): string =>
  `<script>window.BASED=window.BASED||{};window.BASED.opts={${JSON.stringify(opts).replace(/":/g, ':').replace(/,"/g, ',').slice(2, -1)}}</script>`
