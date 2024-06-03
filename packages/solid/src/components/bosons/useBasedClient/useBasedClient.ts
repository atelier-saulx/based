import { useContext } from 'solid-js'
import { BasedClient } from '@based/client'
import { BasedContext } from '../BasedProvider'

/**
 * Hook to get the `BasedClient` context from the `BasedProvider` component.
 * Is useful when you want to inspect the connection with the database.
 *
 * @returns The `BasedClient` object with the information about the connection with the `Based` server. You cal also call functions using the client object.
 */
const useBasedClient = (): BasedClient => useContext(BasedContext)

/**
 * Alias to `useBasedClient`.
 *
 * @deprecated `useClient` is still working, but we're moving to use `useBasedClient` instead.
 */
const useClient = useBasedClient

export { useClient, useBasedClient }
