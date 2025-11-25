import { useContext, useState, useEffect } from 'react'
import { Ctx } from './Ctx.js'
import type { BasedClient, ClientAuthState } from '../client/index.js'

/**
  Observe if a client is authenticated
  
  ```javascript
  const { userId, token, error } = useAuthState()
  ```
*/
export const useAuthState = (): ClientAuthState => {
  const client: BasedClient = useContext(Ctx)
  const [state, setState] = useState<ClientAuthState>(client?.authState || {})

  useEffect(() => {
    if (client) {
      setState(client.authState)
      const listener = (authState) => {
        setState(authState)
      }
      client.on('authstate-change', listener)
      return () => client.off('authstate-change', listener)
    }
  }, [client])

  return state
}
