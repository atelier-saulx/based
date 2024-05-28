import { createSignal, createEffect } from 'solid-js'
import { BasedClient, QueryMap, BasedQuery } from '@based/client'
import { BasedError } from '@based/errors'
import { useBasedClient } from "@/bosons"

type QueryResult<T> = {
    loading: boolean
    data?: T
    error?: BasedError
    checksum?: number
}

type UseQueryOptions = {
    persistent: boolean
}

const useBasedQuery = <N extends keyof QueryMap>(
    db: N,
    payload?: QueryMap[N]['payload'],
    opts?: UseQueryOptions,
): QueryResult<QueryMap[N]['result']> => {
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
            }
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

export default useBasedQuery
