import { AuthState } from './types'

export default (authState: any): AuthState => {
  if (authState === undefined) {
    return {}
  }
  if (typeof authState !== 'string') {
    return { error: 'Invalid token' }
  }
  try {
    return JSON.parse(
      Buffer.from(decodeURI(authState), 'base64').toString('utf8')
    )
  } catch (err) {
    return { error: 'Invalid token' }
  }
}
