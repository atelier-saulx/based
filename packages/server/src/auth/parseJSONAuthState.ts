import { AuthState } from '@based/functions'

export default (authorization: string): AuthState => {
  try {
    return JSON.parse(decodeURIComponent(authorization))
  } catch (err) {}
  return { error: 'Invalid token' }
}
