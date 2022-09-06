export type AuthState = any

export type AuthResponseListeners = {
  [reqId: string]: [(val?: any) => void, (err: Error) => void]
}
