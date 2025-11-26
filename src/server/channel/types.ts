import type { ChannelMessageFunctionInternal } from '../../functions/index.js'

export type ActiveChannel = {
  name: string
  id: number
  payload: any
  doesNotExist?: boolean
  functionChannelClients: Set<ChannelMessageFunctionInternal>
  clients: Set<number>
  oldClients?: Set<number>
  isActive: boolean
  closeAfterIdleTime?: number
  timeTillDestroy: number | null
  isDestroyed: boolean
  closeFunction?: () => void
}

// periodic clean up
