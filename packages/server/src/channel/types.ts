import { ChannelMessageFunction } from '@based/functions'

export type ActiveChannel = {
  name: string
  id: number
  payload: any
  functionChannelClients: Set<ChannelMessageFunction>
  clients: Set<number>
  isActive: boolean
  closeAfterIdleTime?: number
  timeTillDestroy: number | null
  isDestroyed: boolean
  closeFunction?: () => void
}

// periodic clean up
