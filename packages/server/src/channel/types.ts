import { ChannelMessageFunction } from '@based/functions'

export type ActiveChannel = {
  name: string
  id: number
  payload: any
  functionChannelClients: Set<ChannelMessageFunction>
  clients: Set<number>
  isActive: boolean
  isDestroyed: boolean
  beingDestroyed?: NodeJS.Timeout
  closeFunction?: () => void
}

// periodic clean up
