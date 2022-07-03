import { useEffect, useMemo, useReducer, useState } from 'react'

import {
  Query,
  addSubscriber,
  removeSubscriber,
  generateSubscriptionId,
  BasedOpts,
  AnalyticsHistoryOpts,
  AnalyticsOpts,
  AnalyticsTypesOpts,
} from '@based/client'

import { resultReducer } from './reducer'

import { Loading, Data } from './types'

import { genOptsId } from './genOptsId'

import { useClient } from './clients'

import { updateMeta } from './meta'

export * from './meta'
export * from './clients'
export * from './gql'

export { InfiniteList } from './components/InfiniteList'

export function useAuth(
  clientSelector?: string | (BasedOpts & { key?: string })
): { id: string | false; token: string } | false {
  const client = useClient(clientSelector)
  const [token, setToken] = useState<false | string>(false)
  const [id, setId] = useState<false | string>('')
  useEffect(() => {
    const t = (d) => {
      if (d) {
        setId(client.client.user)
        setToken(d)
      }
    }
    client.on('auth', t)
    if (client.client.token) {
      t(client.client.token)
    }
    return () => {
      client.removeListener('auth', t)
    }
  }, [])
  return token ? { token, id } : false
}

export function useSchema(
  name: string | null | false = 'default',
  clientSelector?: string | (BasedOpts & { key?: string })
): {
  schema: Data
  error?: Error
  loading: Loading
} {
  const x = useData(
    name
      ? {
          $subscribe_schema: name,
        }
      : null,
    clientSelector
  )

  return {
    loading: x.loading,
    error: x.error,
    schema: x.data,
  }
}

export function useTrack(
  type: string,
  params?: { [key: string]: number | string | boolean },
  clientSelector?: string | (BasedOpts & { key?: string })
): void {
  if (type) {
    const selector = clientSelector || 'default'
    const client = useClient(selector)
    const id = useMemo(() => {
      return generateSubscriptionId(params, type)
    }, [type, params])
    useEffect(() => {
      client.track(type, params)
      return () => {
        client.untrack(type, params)
      }
    }, [id])
  } else {
    useClient(clientSelector)
    useMemo(() => {}, [])
    useEffect(stubFn, [null, null])
  }
}

export function useData(
  query: Query,
  clientSelector?: string | (BasedOpts & { key?: string })
): {
  data: Data
  error?: Error
  loading: Loading
  checksum: number
}

export function useData(name: string): {
  data: Data
  error?: Error
  loading: Loading
  checksum: number
}

export function useData(query: null): {
  data: Data
  error?: Error
  loading: Loading
  checksum: number
}

export function useData(): {
  data: Data
  error?: Error
  loading: Loading
  checksum: number
}

export function useData(
  name: string,
  payload: any,
  clientSelector?: string | (BasedOpts & { key?: string })
): { data: Data; error?: Error; loading: Loading; checksum: number }

export function useData(
  a?: string | Query,
  payload?: any,
  clientSelector?: string | (BasedOpts & { key?: string })
): {
  data: Data
  error?: Error
  loading: Loading
} {
  const [result, dispatch] = useReducer(resultReducer, {
    loading: true,
    data: {},
    checksum: 0,
  })

  if (a) {
    const subId = useMemo(() => {
      return generateSubscriptionId(typeof a === 'string' ? [a, payload] : a)
    }, [payload, a])

    const isNamed = typeof a === 'string'

    const selector = clientSelector || (!isNamed ? payload : 'default')

    const client = useClient(selector)

    const clientKey =
      typeof selector === 'string' ? selector : genOptsId(selector)

    if (client) {
      const subKey = clientKey + subId

      useEffect(() => {
        updateMeta(subKey, true, false)
        dispatch({ error: null, loading: true, data: {} })
        const [, subscriberId] = addSubscriber(
          client.client,
          isNamed ? payload : a,
          (d, checksum) => {
            updateMeta(subKey, false, false)
            dispatch({ data: d, checksum })
          },
          (err) => {
            if (err) {
              console.error(err)
              updateMeta(subKey, false, err)
              dispatch({ error: err, loading: false })
            }
          },
          (err) => {
            console.error(err)
            updateMeta(subKey, false, err)
            dispatch({ error: err })
          },
          subId,
          typeof a === 'string' ? a : undefined
        )
        return () => {
          updateMeta(subKey, false, false)
          removeSubscriber(client.client, subId, subscriberId)
        }
      }, [subId, clientKey])
    } else {
      useEffect(stubFn, [null, null])
    }
  } else {
    useMemo(stubFn, [payload, a])
    useClient(clientSelector)
    useEffect(stubFn, [null, null])
  }

  return result
}

export function useAnalytics(
  params?: AnalyticsHistoryOpts | AnalyticsTypesOpts | AnalyticsOpts,
  clientSelector?: string | (BasedOpts & { key?: string })
): { data: Data; error?: Error; loading: Loading } {
  const [result, dispatch] = useReducer(resultReducer, {
    loading: true,
    data: {},
    checksum: 0,
  })

  let subId, subscriberId

  const selector = clientSelector || 'default'
  const client = useClient(selector)

  if (client && params) {
    useEffect(() => {
      dispatch({ error: null, loading: true, data: {} })
      addSubscriber(
        client.client,
        params,
        // onData:
        (d, checksum) => {
          // updateMeta(subKey, false, false) ??
          dispatch({ data: d, checksum })
        },
        // onInitial:
        (err, subscriptionId, subscriberIdInner, _data, isAuthError) => {
          subId = subscriptionId
          subscriberId = subscriberIdInner
          if (err || isAuthError) {
            console.error(err)
            // updateMeta(subKey, false, err)
            dispatch({ error: err, loading: false })
          }
        },
        // onError:
        (err) => {
          console.error(err)
          // updateMeta(subKey, false, err)
          dispatch({ error: err })
        },
        undefined,
        'analytics'
      )
      return () => {
        removeSubscriber(client.client, subId, subscriberId)
      }
    }, [])
  } else {
    useEffect(stubFn, [])
  }

  return result
}

function stubFn() {}
