import { BasedClientQuery as BasedQuery } from '@based/client'

export const lastCollected: { q: BasedQuery[] } = { q: [] }

export const collectQuery = (q: BasedQuery) => {
  lastCollected.q.push(q)
}
