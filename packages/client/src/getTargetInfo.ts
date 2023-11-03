import { BasedClient } from './index.js'

export const getTargetInfo = (
  client: BasedClient,
  id: number,
  type: 'channel' | 'sub'
): { name: string; payload?: any; id: number } => {
  const sub =
    type === 'sub' ? client.observeState.get(id) : client.channelState.get(id)
  if (!sub) {
    return { name: `[Cannot find ${id}]`, id }
  }
  return sub.payload
    ? { name: sub.name, payload: sub.payload, id }
    : { name: sub.name, id }
}
