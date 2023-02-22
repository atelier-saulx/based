import { AuthState } from '../types'
import { BasedClient } from '..'
import { setStorage, removeStorage } from '../persistentStorage'

export const updateAuthState = (client: BasedClient, authState: AuthState) => {
  if (authState.persistent) {
    setStorage(client, '@based-authState', authState)
  } else {
    removeStorage(client, '@based-authState')
  }
  client.authState = authState
}
