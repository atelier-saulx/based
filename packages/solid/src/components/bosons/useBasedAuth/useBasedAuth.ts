import { createSignal, createEffect, onCleanup, Accessor } from 'solid-js'
import { BasedClient, AuthState } from '@based/client'
import { useBasedClient } from '../useBasedClient'

/**
 * Hook to check and get the Auth state from the client
 *
 * @returns the `AuthState` object containing all the information about the current state of the authorization with the `Based` cloud.
 */
const useBasedAuth = (): Accessor<AuthState> => {
  const [client] = createSignal<BasedClient>(useBasedClient())
  const [auth, setAuth] = createSignal<AuthState>(client()?.authState || {})

  if (client()) {
    setAuth(client().authState)

    createEffect(() => {
      client().on('authstate-change', setAuth)
      onCleanup(() => client().off('authstate-change', setAuth))
    })
  }

  return auth
}

/**
 * Alias to `useBasedAuth`.
 *
 * @deprecated `useAuthState` is still working, but we're moving to use `useBasedAuth` instead.
 */
const useAuthState = useBasedAuth

export { useAuthState, useBasedAuth }
