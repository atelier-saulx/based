import type { AuthState } from '../../functions/auth.js'

export default (authorization: string): AuthState => {
  try {
    const authState = JSON.parse(decodeURIComponent(authorization))
    for (const key in authState) {
      if (
        key !== 'token' &&
        key !== 'userId' &&
        key !== 'refreshToken' &&
        key !== 'error' &&
        key !== 'persistent' &&
        key !== 'type'
      ) {
        return { error: 'Illegal key in authState ' + key }
      } else if (key === 'persistent' && typeof authState[key] !== 'boolean') {
        return { error: 'Persistent is not a boolean' }
      } else if (key !== 'persistent' && typeof authState[key] !== 'string') {
        return { error: `${key} is not of string` }
      }
    }
    return authState
  } catch (err) {}
  return { error: 'Invalid token' }
}
