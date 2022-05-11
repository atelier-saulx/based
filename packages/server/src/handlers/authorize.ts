import { BasedServer } from '..'
import { RequestTypes, Message, TrackMessage } from '@based/client'
import { Params } from '../Params'
import { getFunction, getAuthorize } from '../getFromConfig'
import { Client } from '../Client'

export default async (
  server: BasedServer,
  client: Client,
  messages: (Message | TrackMessage)[]
): Promise<(Message | TrackMessage)[] | false> => {
  const q = []
  const user = client
  const authorize = await getAuthorize(server)

  for (const msg of messages) {
    if (
      msg[0] === RequestTypes.Auth ||
      msg[0] === RequestTypes.Unsubscribe ||
      msg[0] === RequestTypes.SendSubscriptionData
    ) {
      q.push(true)
      continue
    }
    let type: string
    let name: string
    let payload: any
    if (msg[0] === RequestTypes.Track) {
      type = 'track'
      payload = msg[1]
    } else if (msg[0] === RequestTypes.Copy) {
      type = 'copy'
      payload = msg[2]
    } else if (msg[0] === RequestTypes.Digest) {
      type = 'digest'
      payload = msg[2]
    } else if (msg[0] === RequestTypes.Call) {
      type = 'function'
      name = msg[1]
      payload = msg[3]
    } else if (msg[0] === RequestTypes.GetConfiguration) {
      type = 'schema'
      payload = msg[2]
    } else if (msg[0] === RequestTypes.Configuration) {
      type = 'updateSchema'
      payload = msg[2]
    } else if (msg[0] === RequestTypes.Get) {
      type = 'get'
      // name
      payload = msg[2]
    } else if (msg[0] === RequestTypes.GetSubscription) {
      type = 'get'
      if (msg[4]) {
        name = msg[4]
      }
      payload = msg[2]
    } else if (msg[0] === RequestTypes.Delete) {
      type = 'delete'
      payload = msg[2]
    } else if (msg[0] === RequestTypes.Set) {
      type = 'set'
      payload = msg[2]
    } else if (msg[0] === RequestTypes.Subscription) {
      type = 'observe'
      if (msg[5]) {
        name = msg[5]
      }
      payload = msg[2]
    }

    // SendSubscriptionData not very nessecary - can be done later
    if (!type) {
      client.destroy()
      return false
    }

    if (user?.isBasedUser) {
      const token = await user.token()
      if (token) {
        q.push(true)
        continue
      }
    }

    const customAuth = name && (await getFunction(server, name))?.authorize

    if (customAuth) {
      q.push(
        customAuth(
          new Params(server, payload, user, null, null, name, type, true)
        )
      )
    } else {
      q.push(
        authorize(
          new Params(server, payload, user, null, null, name, type, true)
        )
      )
    }
  }

  const authorized = await Promise.allSettled(q)

  let notAuthCnt = 0
  for (let i = 0; i < authorized.length; i++) {
    const isAuthorized =
      // @ts-ignore
      authorized[i].status === 'fulfilled' && authorized[i].value

    if (!isAuthorized) {
      const msg = messages[i - notAuthCnt]
      messages.splice(i - notAuthCnt, 1)
      notAuthCnt++

      const err =
        // @ts-ignore
        authorized[i].status === 'rejected' && authorized[i].reason.message

      // @ts-ignore
      const code = err ? authorized[i].reason?.code || 0 : 0

      if (msg[0] === RequestTypes.GetSubscription) {
        const [, id, payload, , name] = msg
        client.send([
          RequestTypes.Subscription,
          id,
          0,
          0,
          {
            type: 'AuthorizationError',
            name: name ? `get "${name}"` : 'get',
            message: err || 'Unauthorized request',
            payload,
            code,
            auth: true,
          },
        ])
      } else if (msg[0] === RequestTypes.Subscription) {
        const [, id, payload, , , name] = msg
        client.send([
          RequestTypes.Subscription,
          id,
          0,
          0,
          {
            type: 'AuthorizationError',
            name: name ? `observe "${name}"` : 'observe',
            message: err || 'Unauthorized request',
            payload,
            code,
            auth: true,
          },
        ])
      } else if (msg[0] === RequestTypes.Call) {
        const [, name, reqId, payload] = msg
        client.send([
          RequestTypes.Call,
          reqId,
          0,
          {
            type: 'AuthorizationError',
            name: `call "${name}"`,
            auth: true,
            message: err || 'Unauthorized request',
            payload,
            code,
          },
        ])
      } else if (
        msg[0] === RequestTypes.Set ||
        msg[0] === RequestTypes.Get ||
        msg[0] === RequestTypes.Configuration ||
        msg[0] === RequestTypes.GetConfiguration ||
        msg[0] === RequestTypes.Delete ||
        msg[0] === RequestTypes.Copy ||
        msg[0] === RequestTypes.Digest ||
        msg[0] === RequestTypes.Track
      ) {
        client.send([
          msg[0],
          msg[1],
          0,
          {
            type: 'AuthorizationError',
            name: RequestTypes[msg[0]].toLowerCase(),
            message: err || 'Unauthorized request',
            auth: true,
            code,
            payload: msg[2], // if observe or get without name call it query
          },
        ])
      } else {
        console.error(
          'Not handling request in not authorized handler! ' +
            RequestTypes[msg[0]]
        )
      }
    }
  }

  return messages
}
