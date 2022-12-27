import { BasedServer, ServerOptions } from './server'

const createServer = async (
  props: ServerOptions,
  sharedSocket?: boolean
): Promise<BasedServer> => {
  const basedServer = new BasedServer(props)
  return props.port ? basedServer.start(props.port, sharedSocket) : basedServer
}

export { BasedServer }

export default createServer

// maybe send responsed
export { compress } from './compress'
export { sendHttpResponse } from './sendHttpResponse'
export { sendError } from './sendError'
export { createSimpleServer } from './createSimpleServer'

export * from './auth/types'
export * from './functions/types'
export * from './error'
export * from './api'
