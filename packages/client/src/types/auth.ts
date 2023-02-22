export type AuthState = {
  token?: string
  userId?: string
  refreshToken?: string
  error?: string
  persistent?: boolean
  type?: string
}

export type AuthResponseListeners = {
  [reqId: string]: [(val?: any) => void, (err: Error) => void]
}
