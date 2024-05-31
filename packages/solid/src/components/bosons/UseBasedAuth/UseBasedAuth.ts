import { useContext, createSignal, createEffect } from 'solid-js'
import { BasedContext } from '@/bosons'
import { BasedClient, AuthState } from '@based/client'

/**
 * Hook to check and get the Auth state from the client
 *
 * @returns the `AuthState` object containing all the information about the current state of the authorization with the `Based` cloud.
 */
const useBasedAuth = (): AuthState => {
  const client: BasedClient = useContext(BasedContext)
  const [auth, setAuth] = createSignal<AuthState>(client?.authState || {})

  createEffect(() => {
    if (!client) {
      return
    }

    setAuth(client.authState)

    const listener = (authState: AuthState) => {
      setAuth(authState)
    }

    client.on('authstate-change', listener)

    return () => client.off('authstate-change', listener)
  }, [client])

  return auth()
}

/**
 * Alias to `useBasedAuth`.
 *
 * @deprecated `useAuthState` is still working, but we're moving to use `useBasedAuth` instead.
 */
const useAuthState = useBasedAuth

export { useAuthState, useBasedAuth }
