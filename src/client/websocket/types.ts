import WebSocket from 'isomorphic-ws'

export class Connection {
  public ws?: WebSocket
  public disconnected?: boolean
  destroy: () => void
  public fallBackTimer?: ReturnType<typeof setTimeout>
  public fallBackInProgress?: boolean
  public useFallback?: string
  public keepAliveCloseTimer?: ReturnType<typeof setTimeout>
  public keepAliveLastUpdated?: number
}
