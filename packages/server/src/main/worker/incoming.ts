import { BasedServer } from '../server'

// data will be incoming worker message
export const incomingWorkerMessage = (server: BasedServer, data: any) => {
  console.info(server, data)

  // updateTimeoutCounter
}
