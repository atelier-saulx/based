import { BasedDbClient } from '.'

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

        const buffs = []
        let l = 0

        // ------- Command
        for (const c of commands) {
          console.log('PREP THIS COMMAND', c)
          // const { buffers, len } = encodeFunctionMessage(f)
          // buffs.push(...buffers)
          // l += len
        }

        const n = new Uint8Array(l)
        let c = 0
        for (const b of buffs) {
          n.set(b, c)
          c += b.length
        }

        client.commandQueue = []

        console.log('GO SEND FOR REAL')
        // GO SEND SOME STUFF
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
  command: string,
  resolve: (response: any) => void,
  reject: (err: Error) => void
) => {
  client.seqId++
  const id = client.seqId
  client.commandResponseListeners.set(id, [resolve, reject])
  client.commandQueue.push([id, command, payload])
  drainQueue(client)
}
// ------------------------------------------------
