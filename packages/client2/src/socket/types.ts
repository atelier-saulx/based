import { Socket } from 'node:net'

export type Connection = {
  socket?: Socket
  disconnected?: boolean
}
