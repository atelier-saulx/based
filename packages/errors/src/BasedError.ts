import { BasedErrorCode } from './types.js'

export class BasedError extends Error {
  public statusMessage?: string
  public code?: BasedErrorCode
}
