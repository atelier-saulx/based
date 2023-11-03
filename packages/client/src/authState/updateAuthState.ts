import { AuthState } from '../types/index.js'
import { BasedClient } from '../index.js'
import { setStorage, removeStorage } from '../persistentStorage/index.js'

export const updateAuthState = (client: BasedClient, authState: AuthState) => {
  if (authState.persistent) {
    setStorage(client, '@based-authState', authState)
  } else {
    removeStorage(client, '@based-authState')
  }
  client.authState = authState
}
