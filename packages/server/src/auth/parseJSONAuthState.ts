import { AuthState } from '@based/functions'

export default (authorization: string): AuthState => {
  try {
    return JSON.parse(decodeURI(authorization))
  } catch (err) {}
  return { error: 'Invalid token' }
}
