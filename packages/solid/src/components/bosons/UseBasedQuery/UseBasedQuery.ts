import { Accessor, createSignal, onCleanup } from 'solid-js'
import { BasedClient, QueryMap as BasedQueryMap } from '@based/client'
import { BasedError } from '@based/errors'
import { useBasedClient } from '../UseBasedClient'

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
 *   "checksum": 120823798,
 *   "error": null
 * }
 * ```
 */
type BasedQueryResult<T> = {
  /** If the query is still loading. **/
  loading: Accessor<boolean>
  /** The data coming from your filters. **/
  data?: Accessor<T> | Accessor<null>
  /** The `BasedError` object containing the `statusMessage` and `code` from your error. **/
  error?: Accessor<BasedError> | Accessor<null>
  /** A calculated value used to verify data integrity and detect errors. Each response has a unique checksum. **/
  checksum?: Accessor<number> | Accessor<null>
}

type BasedQueryOptions = {
  /** When is **true** will store the cached result of a query in `localStorage` on the client-side. Otherwise, the cache is only in volatile memory. **/
  persistent: boolean
}

/**
 * Hook to declare a query that invoke a `Based` function.
 *
 * @param name - The function name that you want to invoke.
 * @param payload - The filters and mutations that you want to apply to you data.
 * @param opts - You can set `persistent` to true to store the cached result of a query in `localStorage` on the client-side.
 *
 * @returns The `BasedQueryResult` object with 4 signals to be consumed: `loading()`, `data()`, `error()` and `checksum()`.
 *
 * @remarks
 * You need to destruct the returned object to get access to the signals.
 *
 * @example
 * const result = useBasedQuery('counter', {
 *   count: true,
 * })
 */
const useBasedQuery = <N extends keyof BasedQueryMap>(
  name: N,
  payload?: BasedQueryMap[N]['payload'],
  opts?: BasedQueryOptions,
): BasedQueryResult<BasedQueryMap[N]['result']> => {
  const [loading, setLoading] = createSignal<boolean>(true)
  const [checksum, setChecksum] = createSignal<number | null>(null)
  const [error, setError] = createSignal<BasedError | null>(null)
  const [data, setData] = createSignal<any | null>(null)

  const onData = (data: any, checksum: number) => {
    setLoading(false)
    setChecksum(checksum)
    setData({ ...data })
  }

  const onError = (error: BasedError) => {
    setLoading(false)
    setError({ ...error })
  }

  const client: BasedClient = useBasedClient()

  if (!client || !name) {
    return
  }

  const basedQuery = client.query(
    name as string,
    payload,
    opts as BasedQueryOptions,
  )

  const unsubscribe = basedQuery.subscribe(onData, onError)

  onCleanup(() => unsubscribe())

  return { loading, checksum, error, data }
}

/**
 * Alias to `useBasedQuery`.
 *
 * @deprecated `useQuery` is still working, but we're moving to use `useBasedQuery` instead.
 */
const useQuery = useBasedQuery

export { useQuery, useBasedQuery }
