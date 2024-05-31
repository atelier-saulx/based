import { createSignal, createEffect } from 'solid-js'
import {
  BasedClient,
  QueryMap as BasedQueryMap,
  BasedQuery,
} from '@based/client'
import { BasedError } from '@based/errors'
import { useBasedClient } from '@/bosons'

/**
 * The query result type from `Based` functions.
 *
 * @typeParam T - Mapped from `BasedQueryMap` type.
 *
 * @example Reading the query result object.
 * ```json
 * {
 *   "loading": false,
 *   "data": {
 *      "name": "John Doe"
 *   },
 *   "checksum": 120823798
 * }
 * ```
 */
type BasedQueryResult<T> = {
  /** If the query is still loading. **/
  loading: boolean
  /** The data coming from your filters. **/
  data?: T
  /** The `BasedError` object containing the `statusMessage` and `code` from your error. **/
  error?: BasedError
  /** A calculated value used to verify data integrity and detect errors. Each response has a unique checksum. **/
  checksum?: number
}

type BasedQueryOptions = {
  /** When is **true** will store the cached result of a query in `localStorage` on the client-side. Otherwise, the cache is only in volatile memory. **/
  persistent: boolean
}

/**
 * Hook to declare a query that invoke a `Based` function.
 *
 * @param db - The function name that you want to invoke.
 * @param payload - The filters and mutations that you want to apply to you data.
 * @param opts - You can set `persistent` to true to store the cached result of a query in `localStorage` on the client-side.
 *
 * @returns The `BasedQueryResult` object with you data or an error message.
 */
const useBasedQuery = <N extends keyof BasedQueryMap>(
  db: N,
  payload?: BasedQueryMap[N]['payload'],
  opts?: BasedQueryOptions,
): BasedQueryResult<BasedQueryMap[N]['result']> => {
  const client: BasedClient = useBasedClient()
  const dbName: string = db as string

  if (!client || !dbName) {
    return { loading: true }
  }

  const query: BasedQuery<any, any> = client.query(dbName, payload, opts)
  const { cache } = query

  const [checksum, setChecksum] = createSignal<number>(cache?.c)
  const [error, setError] = createSignal<BasedError>(cache?.c)

  createEffect(() => {
    const unsubscribe = query.subscribe(
      (_, checksum) => {
        setChecksum(checksum)
      },
      (err) => {
        setError(err)
      },
    )

    return () => {
      unsubscribe()
      setChecksum(0)
    }
  })

  if (!checksum() && !error()) {
    return { loading: true }
  }

  if (checksum()) {
    if (!cache) {
      return { loading: true }
    }

    return { loading: false, data: cache.v, checksum: checksum() }
  }

  return { loading: false, error: error() }
}

/**
 * Alias to `useBasedQuery`.
 *
 * @deprecated `useQuery` is still working, but we're moving to use `useBasedQuery` instead.
 */
const useQuery = useBasedQuery

export { useQuery, useBasedQuery }
