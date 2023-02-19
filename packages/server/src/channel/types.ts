import { ChannelMessageFunction } from '@based/functions'

export type ActiveChannel = {
  name: string
  id: number
  channelId: any
  functionChannelClients: Set<ChannelMessageFunction>
  clients: Set<number>
  isDestroyed: boolean
  beingDestroyed?: NodeJS.Timeout
  closeFunction?: () => void
}

// periodic clean up
