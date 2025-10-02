import { useContext, useState, useEffect } from 'react'
import { BasedClient, ClientAuthState as AuthState } from '@based/client'
import { Ctx } from './Ctx.js'

/**
  Observe if a client is authenticated
  
  ```javascript
  const { userId, token, error } = useAuthState()
  ```
*/
export const useAuthState = (): AuthState => {
  const client: BasedClient = useContext(Ctx)
  const [state, setState] = useState<AuthState>(client?.authState || {})

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
