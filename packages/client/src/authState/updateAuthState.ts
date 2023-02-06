import { AuthState } from '../types'
import { BasedClient } from '..'

export const updateAuthState = (client: BasedClient, authState: AuthState) => {
  console.info('go go go')
  client.authState = authState
}
