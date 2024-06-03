import { createSignal, createEffect, Accessor } from 'solid-js'
import { BasedClient } from '@based/client'
import { useBasedClient } from '../useBasedClient'

/**
 * The three possible connection status with `Based`.
 */
export enum BasedStatus {
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect',
  CONNECT = 'connect',
}

/**
 * The response from the `useBasedStatus`/`useStatus` hook.
 */
type BasedConnection = {
  /** If the connection is established or not. **/
  connected: Accessor<boolean>
  /** One of the three possible status. **/
  status: Accessor<BasedStatus>
}

/**
 * Hook to get the connection status from the `Based` client.
 *
 * @returns The `BasedConnection` object with the status of the connection.
 */
const useBasedStatus = (): BasedConnection => {
  const client: BasedClient = useBasedClient()
  const [connected, setConnected] = createSignal(client.connected)
  const [status, setStatus] = createSignal<BasedStatus>(BasedStatus.DISCONNECT)

  createEffect(() => {
    if (!client) {
      return
    }

    setConnected(client.connected)

    const onDisconnect = (): void => {
      setConnected(client.connected)
      setStatus(BasedStatus.DISCONNECT)
    }

    const onReconnect = (): void => {
      setConnected(client.connected)
      setStatus(BasedStatus.RECONNECT)
    }

    const onConnect = (): void => {
      setConnected(client.connected)
      setStatus(BasedStatus.CONNECT)
    }

    client.on(BasedStatus.DISCONNECT, onDisconnect)
    client.on(BasedStatus.RECONNECT, onReconnect)
    client.on(BasedStatus.CONNECT, onConnect)

    return () => {
      client.off(BasedStatus.DISCONNECT, onDisconnect)
      client.off(BasedStatus.RECONNECT, onReconnect)
      client.off(BasedStatus.CONNECT, onConnect)
    }
  }, [client])

  return {
    connected,
    status,
  }
}

/**
 * Alias to `useBasedStatus`.
 *
 * @deprecated `useStatus` is still working, but we're moving to use `useBasedStatus` instead.
 */
const useStatus = useBasedStatus

export { useStatus, useBasedStatus }
