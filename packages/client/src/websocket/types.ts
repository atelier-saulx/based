import WebSocket from 'isomorphic-ws'

export class Connection {
  public ws?: WebSocket
  public disconnected?: boolean
  destroy: () => void
}
