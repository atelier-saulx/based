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
  const client = ref<BasedClient>(inject(BasedContext.CLIENT))
  const auth = ref<AuthState>(client?.value.authState || {})

  if (client.value) {
    auth.value = client.value.authState

    const listener = (authState: AuthState) => {
      auth.value = authState
    }

    watchEffect((onCleanup) => {
      client.value.on('authstate-change', listener)
      onCleanup(() => client.value.off('authstate-change', listener))
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
