import { createSignal, createEffect } from "solid-js"
import { BasedClient } from '@based/client'
import { useBasedClient } from "@/bosons"

/**
 * The three possible connection status with `Based`.
 */
export enum BasedStatus {
    DISCONNECT = 'disconnect',
    RECONNECT = 'reconnect',
    CONNECT = 'connect'
}

/**
 * The response from the `useBasedStatus`/`useStatus` hook.
 */
type BasedConnection = {
    /** If the connection is established or not. **/
    connected: boolean,
    /** One of the three possible status. **/
    status: BasedStatus
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
        if (client) {
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
        }
    }, [client])

  return {
      connected: connected(),
      status: status()
    }
}

/**
 * Alias to `useBasedStatus`.
 */
const useStatus = useBasedStatus

export { useStatus }
export default useBasedStatus