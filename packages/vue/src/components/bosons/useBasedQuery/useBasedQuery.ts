import { ref, inject, watchEffect } from 'vue'
import type { Ref } from 'vue'
import { BasedClient } from '@based/client'
import type { QueryMap as BasedQueryMap } from '@based/client'
import type { BasedError } from '@based/errors'
import { BasedContext } from '../BasedProvider'

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
  loading: Ref<boolean>
  /** The data coming from your filters. **/
  data?: Ref<T> | Ref<null>
  /** The `BasedError` object containing the `statusMessage` and `code` from your error. **/
  error?: Ref<BasedError> | Ref<null>
  /** A calculated value used to verify data integrity and detect errors. Each response has a unique checksum. **/
  checksum?: Ref<number> | Ref<null>
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
 * @returns The `BasedQueryResult` object with 4 Refs to be consumed: `loading`, `data`, `error` and `checksum`.
 *
 * @remarks
 * You need to destruct the returned object to get access to the Refs.
 *
 * @example
 * const { data, loading, error, checksum } = useBasedQuery('counter', {
 *   count: true,
 * })
 */
const useBasedQuery = <N extends keyof BasedQueryMap>(
  name: N,
  payload?: BasedQueryMap[N]['payload'],
  opts?: BasedQueryOptions,
): BasedQueryResult<BasedQueryMap[N]['result']> => {
  const loading = ref<boolean>(true)
  const checksum = ref<number | null>(null)
  const error = ref<BasedError | null>(null)
  const data = ref<any | null>(null)

  const client: BasedClient = inject(BasedContext.CLIENT)

  if (client && name) {
    const onData = (_data: any, _checksum: number) => {
      loading.value = false
      checksum.value = _checksum
      data.value = { ..._data }
    }

    const onError = (_error: BasedError) => {
      loading.value = false
      error.value = { ..._error }
    }

    watchEffect((onCleanup) => {
      const basedQuery = client.query(name as string, payload, opts)
      onCleanup(basedQuery.subscribe(onData, onError))
    })
  }

  return { loading, checksum, error, data }
}

/**
 * Alias to `useBasedQuery`.
 *
 * @deprecated `useQuery` is still working, but we're moving to use `useBasedQuery` instead.
 */
const useQuery = useBasedQuery

export { useQuery, useBasedQuery }
