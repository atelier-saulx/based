import { BasedServer } from '..'
import { RequestTypes } from '@based/client'
import Client from '../Client'
import { FunctionObservable } from './functions/observable'
import { Params } from '../Params'
import { getFunction, getAuthorize } from '../getFromConfig'
import { SendTokenOptions } from '../types'

const renewOnInitial = async (client, server, refreshToken) => {
  const { function: fn } = (await getFunction(server, 'renewToken')) || {}
  if (!fn) {
    throw new Error('Token expired and needs to be renewed.')
  }
  const result = await fn(
    new Params(server, { refreshToken }, client, ['renewToken'])
  )
  return result
}

export default async (
  client: Client,
  server: BasedServer,
  token: string | false,
  options?: SendTokenOptions
) => {
  client.setToken(token, options)

  const authorize = await getAuthorize(server)

  if (authorize) {
    const q = []
    const ids = ['']

    q.push(
      authorize(
        new Params(server, {}, client, null, null, null, 'validateToken')
      )
    )

    for (const sub in client.subscriptions) {
      const subscription = client.subscriptions[sub]

      // @ts-ignore
      const isCustom = !subscription.observable?.getOptions

      const payload = isCustom
        ? // @ts-ignore
          subscription.payload
        : // @ts-ignore
          subscription.observable?.getOptions

      ids.push(sub)

      const customAuth =
        // @ts-ignore
        isCustom && (await getFunction(server, subscription.name))?.authorize

      if (customAuth) {
        q.push(
          customAuth(
            new Params(
              server,
              payload,
              client,
              null,
              null,
              // @ts-ignore
              subscription.name,
              'observe'
            )
          )
        )
      } else {
        q.push(
          authorize(
            new Params(
              server,
              payload,
              client,
              null,
              null,
              // @ts-ignore
              subscription.name || null,
              'observe'
            )
          )
        )
      }
    }

    client.authorizeInProgress = Promise.allSettled(q)

    client.authorizeInProgress.then((v) => {
      delete client.authorizeInProgress
      const sendErrors = []
      let hasErrored = false

      let letsTryToRenew = false

      if (v[0].status === 'rejected' || v[0].value === false) {
        hasErrored = true
        if (
          options &&
          // @ts-ignore
          options.refreshToken &&
          v[0]?.reason?.message.includes('Token expired')
        ) {
          letsTryToRenew = true
          // @ts-ignore
          renewOnInitial(client, server, options.refreshToken)
            .then((v) => {
              if (v.token) {
                client.send([RequestTypes.Token, [], false, v.token])
              } else {
                for (let i = 1; i < v.length; i++) {
                  const x = v[i]
                  if (x.status === 'rejected' || x.value === false) {
                    // send back deAuth
                    sendErrors.push(Number(ids[i]))
                  } else if (
                    client.subscriptions[ids[i]] instanceof FunctionObservable
                  ) {
                    const s = <FunctionObservable>client.subscriptions[ids[i]]
                    s.clients[client.id]?.init()
                  }
                }
                for (const sub of sendErrors) {
                  client.subscriptions?.[sub].unsubscribe(client)
                }
                client.send([RequestTypes.Token, sendErrors, hasErrored])
              }
            })
            .catch(() => {
              for (let i = 1; i < v.length; i++) {
                const x = v[i]
                if (x.status === 'rejected' || x.value === false) {
                  // send back deAuth
                  sendErrors.push(Number(ids[i]))
                } else if (
                  client.subscriptions[ids[i]] instanceof FunctionObservable
                ) {
                  const s = <FunctionObservable>client.subscriptions[ids[i]]
                  s.clients[client.id]?.init()
                }
              }
              for (const sub of sendErrors) {
                client.subscriptions?.[sub].unsubscribe(client)
              }
              client.send([RequestTypes.Token, sendErrors, hasErrored])
            })
        }
      }

      if (!letsTryToRenew) {
        for (let i = 1; i < v.length; i++) {
          const x = v[i]
          if (x.status === 'rejected' || x.value === false) {
            // send back deAuth
            sendErrors.push(Number(ids[i]))
          } else if (
            client.subscriptions[ids[i]] instanceof FunctionObservable
          ) {
            const s = <FunctionObservable>client.subscriptions[ids[i]]
            s.clients[client.id]?.init()
          }
        }
        for (const sub of sendErrors) {
          client.subscriptions?.[sub].unsubscribe(client)
        }
        client.send([RequestTypes.Token, sendErrors, hasErrored])
      }
    })
  }
}
