import type { BasedClientQuery } from '../client/index.js'

export const lastCollected: { q: BasedClientQuery[] } = { q: [] }

export const collectQuery = (q: BasedClientQuery) => {
  lastCollected.q.push(q)
}
