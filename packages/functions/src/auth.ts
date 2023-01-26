export type AuthState = {
  token?: string
  userId?: string
  refreshToken?: string
  error?: string
  persistent?: boolean
  type?: string
}
