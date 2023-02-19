import { ChannelMessageFunction } from '@based/functions'

export type Channel = {
  name: string
  id: number
  channelId: any
  functionChannelClients: Set<ChannelMessageFunction>
  clients: Set<number>
  isDestroyed: boolean
  closeFunction?: () => void
}

// periodic clean up
