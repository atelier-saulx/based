import { AuthorizeAvanced } from '../../types'

export const authorizeAdvanced: AuthorizeAvanced = async (
  server,
  ws,
  type,
  name,
  payload
) => {
  return server.auth.config, authorizeAdvanced(server, ws, type, name, payload)
}
