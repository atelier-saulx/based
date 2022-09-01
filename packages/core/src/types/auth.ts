export type AuthState =
  | {
      token: false
    }
  | {
      token: string
      refreshToken?: string
      user?: string
    }

export type AuthResponseListeners = {
  [reqId: string]: [(val?: any) => void, (err: Error) => void]
}
