import { inject, ref, watchEffect } from 'vue'
import type { Ref } from 'vue'
import { BasedClient } from '@based/client'
import type { AuthState } from '@based/client'
import { BasedContext } from '../BasedProvider'

/**
 * Hook to check and get the Auth state from the client
 *
 * @returns the `AuthState` Ref object containing all the information about the current state of the authorization with the `Based` cloud.
 */
const useBasedAuth = (): Ref<AuthState> => {
  const client: BasedClient = inject(BasedContext.CLIENT)
  const auth = ref<AuthState>(client?.authState || {})

  watchEffect((onCleanup) => {
    if (!client) {
      return
    }

    auth.value = client.authState

    const listener = (authState: AuthState) => {
      auth.value = authState
    }

    client.on('authstate-change', listener)

    onCleanup(() => client.off('authstate-change', listener))
  })

  return auth
}

/**
 * Alias to `useBasedAuth`.
 *
 * @deprecated `useAuthState` is still working, but we're moving to use `useBasedAuth` instead.
 */
const useAuthState = useBasedAuth

export { useAuthState, useBasedAuth }
