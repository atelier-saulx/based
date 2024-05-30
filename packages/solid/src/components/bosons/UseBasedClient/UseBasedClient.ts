import { useContext } from 'solid-js'
import { BasedClient } from '@based/client'
import { BasedContext } from "@/bosons"

/**
 * Hook to get the `BasedClient` context from the `BasedProvider` component.
 * Is useful when you want to inspect the connection with the database.
 *
 * @returns The `BasedClient` object with the information about the connection with the `Based` server. You cal also call functions using the client object.
 */
const useBasedClient = (): BasedClient => {
  return useContext(BasedContext)
}

/**
 * Alias to `useBasedClient`.
 */
const useClient = useBasedClient

export { useClient }
export default useBasedClient
