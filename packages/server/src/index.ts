import type { ServerOptions } from './types'
import { BasedServer } from './server'

export { BasedServer }

const createServer = async (props: ServerOptions): Promise<BasedServer> => {
  const basedServer = new BasedServer(props)
  return props.port ? basedServer.start() : basedServer
}

export default createServer

export * from './types'

// maybe send responsed
export { compress } from './network/http/compress'
export { sendHttpResponse, sendHttpError } from './network/http/send'
