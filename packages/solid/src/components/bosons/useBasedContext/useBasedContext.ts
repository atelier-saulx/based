import { useContext } from 'solid-js'
import { BasedClient } from '@based/client'
import { BasedContext } from '../BasedProvider'

/**
 * Hook to get the `BasedClient` context from the `BasedProvider` component.
 * Is useful when you want to inspect the connection with the database.
 *
 * @returns The `BasedClient` object with the information about the connection with the `Based` server. You cal also call functions using the client object.
 */
const useBasedContext = (): BasedClient => {
  const context: BasedClient = useContext(BasedContext)

  if (!context) {
    throw new Error('useBasedContext: cannot find a BasedContext')
  }

  return context
}

/**
 * Alias to `useBasedContext`.
 *
 * @deprecated `useClient` is still working, but we're moving to use `useBasedContext` instead.
 */
const useClient = useBasedContext

export { useClient, useBasedContext }
