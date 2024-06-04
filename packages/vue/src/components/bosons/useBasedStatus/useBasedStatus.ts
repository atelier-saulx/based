import { inject, ref, watchEffect } from 'vue'
import type { Ref } from 'vue'
import { BasedClient } from '@based/client'
import { BasedContext } from '../BasedProvider'

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
  connected: Ref<boolean>
  /** One of the three possible status. **/
  status: Ref<BasedStatus>
}

/**
 * Hook to get the connection status from the `Based` client.
 *
 * @returns The `BasedConnection` object with the status of the connection.
 *
 * @remarks
 * All the returned keys are reactive Refs.
 *
 * @example
 * const { status, connected } = useBasedStatus()
 *
 */
const useBasedStatus = (): BasedConnection => {
  const client: BasedClient = inject(BasedContext.CLIENT)
  const connected = ref(client.connected)
  const status = ref<BasedStatus>(BasedStatus.DISCONNECT)

  if (!client) {
    return
  }

  watchEffect((onCleanup) => {
    connected.value = client.connected

    const onDisconnect = (): void => {
      connected.value = client.connected
      status.value = BasedStatus.DISCONNECT
    }

    const onReconnect = (): void => {
      connected.value = client.connected
      status.value = BasedStatus.RECONNECT
    }

    const onConnect = (): void => {
      connected.value = client.connected
      status.value = BasedStatus.CONNECT
    }

    client.on(BasedStatus.DISCONNECT, onDisconnect)
    client.on(BasedStatus.RECONNECT, onReconnect)
    client.on(BasedStatus.CONNECT, onConnect)

    onCleanup(() => {
      client.off(BasedStatus.DISCONNECT, onDisconnect)
      client.off(BasedStatus.RECONNECT, onReconnect)
      client.off(BasedStatus.CONNECT, onConnect)
    })
  })

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
