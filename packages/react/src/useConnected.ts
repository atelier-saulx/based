import { useContext, useState, useEffect } from 'react'
import { BasedClient } from '@based/client'
import { Ctx } from './Ctx.js'

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
