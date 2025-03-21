import { ChannelMessageFunctionInternal } from '@based/functions'

export type ActiveChannel = {
  name: string
  id: number
  payload: any
  doesNotExist?: boolean
  functionChannelClients: Set<ChannelMessageFunctionInternal>
  clients: Set<number>
  isActive: boolean
  closeAfterIdleTime?: number
  timeTillDestroy: number | null
  isDestroyed: boolean
  closeFunction?: () => void
}

// periodic clean up
