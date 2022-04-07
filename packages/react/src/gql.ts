import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  addSubscriber,
  removeSubscriber,
  handleGraphqlVariables,
  BasedGraphQL,
  generateSubscriptionId,
  BasedOpts,
} from '@based/client'
import { Loading, Data } from './types'
import { resultReducer } from './reducer'
import { useClient } from './clients'
import { genOptsId } from './genOptsId'
import { updateMeta } from './meta'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

const schemaSubId = generateSubscriptionId({ $subscribe_schema: 'default' })

// step one make 1 useEffect
//  - and the nessecary if

export function useQuery(
  query?: string | BasedGraphQL,
  variables: Record<string, any> = {},
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

  const r = useRef({ checksum: 0, fns: {} })
  const selector = clientSelector || 'default'
  const client = useClient(selector)

  if (query) {
    const [configState, updateConfigState] = useState(0)

    useEffect(() => {
      const [, subscriberId] = addSubscriber(
        client.client,
        // FIXME dont want too many updates plz this has to become 1 use effect
        { $subscribe_schema: 'default' },
        (d, checksum) => {
          if (!client.client.configuration) {
            client.client.configuration = {
              dbs: [],
              schema: {},
              functions: {},
            } as any // TODO: FIX
          }
          client.client.configuration.schema.default = d
          updateConfigState(checksum)
        },
        (err) => {
          if (err) {
            console.error(err)
          }
        },
        (err) => {
          console.error(err)
        },
        schemaSubId
      )
      return () => {
        removeSubscriber(client.client, schemaSubId, subscriberId)
      }
      return () => {}
    }, [])

    if (configState) {
      let op: BasedGraphQL
      if (typeof query === 'string') {
        op = client.gql(query)
      } else {
        op = query
      }

      op = handleGraphqlVariables(op, op, variables)

      const fns: {
        [key: string]: { name: string; payload: any; key: string }
      } = {}
      const queryObj: any = {}
      for (const key in op.ops) {
        if (op.ops[key].fnObserve) {
          const { name, payload } = op.ops[key].fnObserve
          fns[key] = { name: <string>name, payload, key }
          continue
        }
        queryObj[key] = op.ops[key].get
      }

      const fnHash = useMemo(() => {
        return hashObjectIgnoreKeyOrder(fns)
      }, [fns])

      const subId = useMemo(() => {
        // fn?
        return generateSubscriptionId(queryObj)
      }, [queryObj])

      const clientKey =
        typeof selector === 'string' ? selector : genOptsId(selector)

      if (client) {
        const subKey = clientKey + subId

        useEffect(() => {
          const subs = []

          for (const key in fns) {
            subs.push(
              addSubscriber(
                client.client,
                fns[key].payload,
                (d, checksum) => {
                  updateMeta(subKey, false, false)
                  if (r.current.fns[key] !== checksum) {
                    r.current.fns[key] = checksum
                    dispatch({
                      merge: { [key]: d },
                      checksum: hashObjectIgnoreKeyOrder(r.current),
                    })
                  }
                },
                (err) => {
                  if (err) {
                    console.error(err)
                    dispatch({ error: err, loading: false })
                  }
                },
                (err) => {
                  console.error(err)
                  updateMeta(subKey, false, err)
                  dispatch({ error: err })
                },
                undefined,
                fns[key].name
              )
            )
          }

          return () => {
            for (const [subId, subscriberId] of subs) {
              removeSubscriber(client.client, subId, subscriberId)
            }
          }
        }, [fnHash])

        useEffect(() => {
          if (!configState) {
            return
          }
          updateMeta(subKey, true, false)
          const [, subscriberId] = addSubscriber(
            client.client,
            queryObj,
            (d, checksum) => {
              updateMeta(subKey, false, false)
              if (r.current.checksum !== checksum) {
                r.current.checksum = checksum
                dispatch({
                  merge: d,
                  checksum: hashObjectIgnoreKeyOrder(r.current),
                })
              }
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
            subId
          )
          return () => {
            updateMeta(subKey, false, false)
            removeSubscriber(client.client, subId, subscriberId)
          }
        }, [subId, clientKey, configState])
      } else {
        useEffect(stubFn, [null, null])
      }
    } else {
      useMemo(stubFn, [null])
      useMemo(stubFn, [null])
      useEffect(stubFn, [null])
      useEffect(stubFn, [null, null, null])
    }
  } else {
    useState(null)
    useEffect(stubFn, [null])
    useMemo(stubFn, [null])
    useMemo(stubFn, [null])
    useEffect(stubFn, [null])
    useEffect(stubFn, [null, null, null])
  }

  return result
}

function stubFn() {}
