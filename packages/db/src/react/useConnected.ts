import { useContext, useState, useEffect } from 'react'
import { Ctx } from './Ctx.js'
import type { BasedClient } from '../client/index.js'

/**
  Observes the connected state of the based client
  
  ```javascript
  const isConnected = useConnected()
  ```
*/
export const useConnected = () => {
  const client: BasedClient = useContext(Ctx)
  const [connected, setConnected] = useState(client.connected)

  useEffect(() => {
    if (client) {
      setConnected(client.connected)
      const listener = () => {
        setConnected(client.connected)
      }
      client.on('disconnect', listener)
      client.on('reconnect', listener)
      client.on('connect', listener)
      return () => {
        client.off('disconnect', listener)
        client.off('reconnect', listener)
        client.off('connect', listener)
      }
    }
  }, [client])

  return { connected }
}
