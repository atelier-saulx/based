export type ClientAuthState = {
  token?: string
  userId?: string | number
  refreshToken?: string
  error?: string
  persistent?: boolean
  type?: string
  // reconnect info
  t?: 0 | 1
  // client version
  v?: 2
}

export type AuthResponseListeners = {
  [reqId: string]: [(val?: any) => void, (err: Error) => void]
}
