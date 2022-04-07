import { SharedFunctionObservable } from './SharedObservable'
import { FunctionObservable } from './Observable'
import { BasedServer } from '../../..'
import Client from '../../../Client'
import {
  generateSubscriptionId,
  RequestTypes,
  SendSubscriptionGetDataMessage,
  SubscribeMessage,
} from '@based/client'
import { DataListener, ObservableFunction } from '../../../types'
import { getFunction } from '../../../getFromConfig'
import { Params } from '../../../Params'
import { Subscription } from '../../subscription'

export { SharedFunctionObservable } from './SharedObservable'
export { FunctionObservable } from './Observable'

export const getObservable = async (
  server: BasedServer,
  client: Client,
  [, id, payload, checksum, name]: SendSubscriptionGetDataMessage
) => {
  const fn = await getFunction(server, name)

  if (fn?.observable === true) {
    let subscription = server.subscriptions[id]
    if (!subscription) {
      subscription = fn.shared
        ? new SharedFunctionObservable(
            server,
            id,
            payload,
            fn,
            name,
            client // not really nessecary will go later
          )
        : new FunctionObservable(server, id, payload, fn, name)
    }
    if (!subscription.clients[client.id]) {
      subscription.subscribe(client, checksum, 1)
    } else {
      subscription.clients[client.id][2] = 2
    }
  } else {
    client.send([
      RequestTypes.Subscription,
      id,
      {},
      0,
      {
        type: 'ObservableDoesNotExistError',
        name: `observable "${name}"`,
        message: `Observable ${name} does not exist`,
        payload,
      },
    ])
  }
}

export const subscribeFunction = async (
  params: Params,
  name: string,
  payload: any,
  dataListener: DataListener
): Promise<
  SharedFunctionObservable | FunctionObservable | Subscription | void
> => {
  const id = generateSubscriptionId(payload, name)
  let subscription = params.server.subscriptions[id]

  const fn = await getFunction(params.server, name)
  if (fn?.observable === true) {
    const observableFunction: ObservableFunction = <ObservableFunction>fn
    subscription = observableFunction.shared
      ? new SharedFunctionObservable(
          params.server,
          id,
          payload,
          observableFunction,
          name,
          undefined,
          dataListener
        )
      : new FunctionObservable(
          params.server,
          id,
          payload,
          observableFunction,
          name
        )
  }

  if (subscription) {
    subscription.subscribeDataListener(
      params.user,
      dataListener,
      params.callStack ? params.callStack.join('.') : params.name
    )
    return subscription
  } else {
    dataListener(null, 0, {
      type: 'ObservableDoesNotExistError',
      name: `observable "${name}"`,
      message: `Observable ${name} does not exist`,
      payload,
    })
  }
}

const subscriptionExists = (
  subscription: SharedFunctionObservable | FunctionObservable | Subscription,
  client: Client,
  allwaysSend: 0 | 1 | 2,
  checksum: number
) => {
  if (subscription.clients[client.id]) {
    if (subscription.clients[client.id][2] === 1) {
      subscription.clients[client.id][2] = 2
    } else if (subscription.clients[client.id][2] === 0 && allwaysSend === 2) {
      subscription.clients[client.id][2] = 2
    }
  } else {
    subscription.subscribe(client, checksum, allwaysSend)
  }
}

export const subscribeObservable = async (
  server: BasedServer,
  client: Client,
  [, id, payload, checksum, allwaysSend, name]: SubscribeMessage
) => {
  let subscription = server.subscriptions[id]

  if (!subscription) {
    const fn = await getFunction(server, name)
    if (fn?.observable === true) {
      const observableFunction: ObservableFunction = <ObservableFunction>fn
      if (!subscription) {
        subscription = observableFunction.shared
          ? new SharedFunctionObservable(
              server,
              id,
              payload,
              observableFunction,
              name,
              client // not really nessecary will go later
            )
          : new FunctionObservable(
              server,
              id,
              payload,
              observableFunction,
              name
            )
        subscription.subscribe(client, checksum, allwaysSend)
      } else {
        subscriptionExists(subscription, client, allwaysSend, checksum)
      }
    } else {
      client.send([
        RequestTypes.Subscription,
        id,
        {},
        0,
        {
          type: 'ObservableDoesNotExistError',
          name: `observable "${name}"`,
          message: `Observable ${name} does not exist`,
          payload,
        },
      ])
    }
  } else {
    if (subscription.clients[client.id]) {
      if (subscription.clients[client.id][2] === 1) {
        subscription.clients[client.id][2] = 2
      } else if (
        subscription.clients[client.id][2] === 0 &&
        allwaysSend === 2
      ) {
        subscription.clients[client.id][2] = 2
      }
    } else {
      subscriptionExists(subscription, client, allwaysSend, checksum)
    }
  }
}
