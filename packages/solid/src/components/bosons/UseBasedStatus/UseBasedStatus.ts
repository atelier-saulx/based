import { createSignal, createEffect } from "solid-js"
import { BasedClient } from '@based/client'
import { useBasedClient } from "@/bosons"

export enum BasedStatus {
    DISCONNECT = 'disconnect',
    RECONNECT = 'reconnect',
    CONNECT = 'connect'
}

const useBasedStatus = () => {
    const client: BasedClient = useBasedClient()
    const [status, setStatus] = createSignal(client.connected)

    createEffect(() => {
        if (client) {
            setStatus(client.connected)

            const listener = () => setStatus(client.connected)

            client.on(BasedStatus.DISCONNECT, listener)
            client.on(BasedStatus.RECONNECT, listener)
            client.on(BasedStatus.CONNECT, listener)

            return () => {
                client.off(BasedStatus.DISCONNECT, listener)
                client.off(BasedStatus.RECONNECT, listener)
                client.off(BasedStatus.CONNECT, listener)
            }
        }
    }, [client])

  return status()
}

export default useBasedStatus