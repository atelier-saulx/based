import { ClientAuthState as AuthState } from '../types/index.js'
import { BasedClient } from '../index.js'
import { setStorage, removeStorage } from '../persistentStorage/index.js'
import { CACHE_AUTH } from '../persistentStorage/constants.js'

export const updateAuthState = (client: BasedClient, authState: AuthState) => {
  if (authState.persistent) {
    setStorage(client, CACHE_AUTH, authState)
  } else {
    removeStorage(client, CACHE_AUTH)
  }
  client.authState = authState
}
