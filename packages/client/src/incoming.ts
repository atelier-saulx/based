import { BasedDbClient } from "."

export const drainQueue = (client: BasedDbClient) => {
    if (
      client.connected &&
      !client.drainInProgress &&
      (client.CommandQueue.length
    ) {
      client.drainInProgress = true
      const drainOutgoing = () => {
        client.drainInProgress = false
  
        if (!client.connected) {
          return
        }
  
        const debug = client.listeners.debug
  
        if (
          client.functionQueue.length ||
          client.observeQueue.size ||
          client.getObserveQueue.size ||
          client.channelQueue.size ||
          client.publishQueue.length
        ) {
          const channel = client.channelQueue
          const publish = client.publishQueue
          const fn = client.functionQueue
          const obs = client.observeQueue
          const get = client.getObserveQueue
  
          const buffs = []
          let l = 0
  
          // ------- Channel
          for (const [id, o] of channel) {
            const { buffers, len } = encodeSubscribeChannelMessage(id, o)
            buffs.push(...buffers)
            l += len
            if (debug) {
              debugChannel(client, id, o)
            }
          }
  
          // ------- GetObserve
          for (const [id, o] of get) {
            const { buffers, len } = encodeGetObserveMessage(id, o)
            buffs.push(...buffers)
            l += len
            if (debug) {
              debugGet(client, id, o)
            }
          }
  
          // ------- Observe
          for (const [id, o] of obs) {
            const { buffers, len } = encodeObserveMessage(id, o)
            buffs.push(...buffers)
            l += len
  
            if (debug) {
              debugObserve(client, id, o)
            }
          }
  
          // ------- Function
          for (const f of fn) {
            const { buffers, len } = encodeFunctionMessage(f)
            buffs.push(...buffers)
            l += len
  
            if (debug) {
              debugFunction(client, f)
            }
          }
  
          // ------- Publish
          for (const f of publish) {
            const { buffers, len } = encodePublishMessage(f)
            buffs.push(...buffers)
  
            if (debug) {
              debugPublish(client, f)
            }
  
            l += len
          }
  
          const n = new Uint8Array(l)
          let c = 0
          for (const b of buffs) {
            n.set(b, c)
            c += b.length
          }
  
          client.functionQueue = []
          client.publishQueue = []
          client.observeQueue.clear()
          client.getObserveQueue.clear()
          client.channelQueue.clear()
  
          client.connection.ws.send(n)
          idleTimeout(client)
        }
      }
  
      client.drainTimeout = setTimeout(drainOutgoing, 0)
    }
  }
  
  export const stopDrainQueue = (client: BasedClient) => {
    if (client.drainInProgress) {
      clearTimeout(client.drainTimeout)
      client.drainInProgress = false
    }
  }
  