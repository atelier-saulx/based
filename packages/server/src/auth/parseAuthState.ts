import { AuthState } from './types'

export default (authState: any): AuthState => {
  if (typeof authState !== 'string') {
    return {}
  }
  try {
    return JSON.parse(authState)
  } catch (err) {}
  return {}
}
