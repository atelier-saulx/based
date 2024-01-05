import { BasedDbClient } from './index.js'
import { encode, Command } from './protocol/index.js'

export const drainQueue = (client: BasedDbClient) => {
  if (
    client.connected &&
    !client.drainInProgress &&
    client.commandQueue.length
  ) {
    client.drainInProgress = true
    const drainOutgoing = () => {
      client.drainInProgress = false

      if (!client.connected) {
        return
      }

      if (client.commandQueue.length) {
        const commands = client.commandQueue

        // ------- Command
        for (const c of commands) {
          const bufs = encode(c.command, c.seqno, c.payload)
          for (const buf of bufs) {
            client.connection.socket.write(buf, (err) => {
              if (!err) {
                return
              }

              const listeners = client.commandResponseListeners.get(c.seqno)

              if (!listeners) {
                return
              }

              const [resolve, reject] = listeners
              client.commandResponseListeners.delete(c.seqno)
              addCommandToQueue(client, c.payload, c.command, resolve, reject)
            })
          }
        }

        client.commandQueue = []
      }
    }

    client.drainTimeout = setTimeout(drainOutgoing, 0)
  }
}

export const stopDrainQueue = (client: BasedDbClient) => {
  if (client.drainInProgress) {
    clearTimeout(client.drainTimeout)
    client.drainInProgress = false
  }
}
// ------------------------------------------------

// ------------ Command ---------------
export const addCommandToQueue = (
  client: BasedDbClient,
  payload: any,
  command: Command,
  resolve: (response: any) => void,
  reject: (err: Error) => void
): number => {
  client.seqId++
  const id = client.seqId
  if (command === 'subscribe') {
    client.subscriptionHandlers.set(id, payload[0])
    resolve(true)
  } else {
    client.commandResponseListeners.set(id, [resolve, reject])
  }
  client.commandQueue.push({ seqno: id, command, payload })
  drainQueue(client)
  return id
}
// ------------------------------------------------
