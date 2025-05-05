import { BasedServer } from '../server.js'
import { ActiveChannel } from './types.js'
import {
  valueToBuffer,
  encodeChannelMessage,
  encodeErrorResponse,
  valueToBufferV1,
} from '../protocol.js'
import { createError } from '../error/index.js'
import { isBasedFunctionConfig } from '@based/functions'
import { BasedErrorCode, BasedErrorData } from '@based/errors'

const updateChannelListener = (
  server: BasedServer,
  channel: ActiveChannel,
  msg: any,
) => {
  if (channel.oldClients.size) {
    const data = encodeChannelMessage(channel.id, valueToBufferV1(msg))
    server.uwsApp.publish(String(channel.id) + '-v1', data, true, false)
  }
  if (channel.clients.size) {
    const data = encodeChannelMessage(channel.id, valueToBuffer(msg))
    server.uwsApp.publish(String(channel.id), data, true, false)
  }
  if (channel.functionChannelClients.size) {
    channel.functionChannelClients.forEach((fnUpdate) => {
      fnUpdate(msg)
    })
  }
}

const errorChannelListener = (
  server: BasedServer,
  channel: ActiveChannel,
  err: Error | BasedErrorData<BasedErrorCode.FunctionError>,
) => {
  err =
    err instanceof Error
      ? createError(
          server,
          {
            session: {
              type: 'channel',
              id: channel.id,
              name: channel.name,
              headers: {},
            },
          },
          BasedErrorCode.FunctionError,
          {
            err,
            channelId: channel.id,
            route: {
              name: channel.name,
              type: 'channel',
            },
          },
        )
      : err.observableId !== channel.id
        ? { ...err, channelId: channel.id }
        : err

  if (channel.clients.size) {
    server.uwsApp.publish(
      String(channel.id),
      encodeErrorResponse(valueToBuffer(err)),
      true,
      false,
    )
  }
  if (channel.functionChannelClients.size) {
    channel.functionChannelClients.forEach((fnUpdate) => {
      fnUpdate(null, err)
    })
  }
}

export const startChannel = (
  server: BasedServer,
  id: number,
  fromInstall?: boolean,
) => {
  const channel = server.activeChannelsById.get(id)

  if (channel.closeFunction) {
    channel.closeFunction()
    delete channel.closeFunction
  }

  const spec = server.functions.specs[channel.name]

  const payload = channel.payload

  if (fromInstall) {
    channel.doesNotExist = false
  }

  if (channel.doesNotExist) {
    return
  }

  if (!spec || !isBasedFunctionConfig('channel', spec)) {
    console.warn(
      'Start channel - cannot find channel function spec',
      channel.name,
    )
    return
  }

  if (spec.relay) {
    const client = server.clients[spec.relay.client]
    if (!client) {
      errorChannelListener(
        server,
        channel,
        new Error(`Relay client ${spec.relay} does not exist`),
      )
      return
    }
    channel.closeFunction = client
      .channel(spec.relay.target ?? channel.name, channel.payload)
      .subscribe(
        (msg) => {
          updateChannelListener(server, channel, msg)
        },
        (err) => {
          errorChannelListener(server, channel, err)
        },
      )
  } else if (!fromInstall || channel.isActive) {
    channel.isActive = true
    try {
      if (spec.throttle) {
        let tempMsg: any
        let isThrottled: boolean
        let throtDebounced = false

        const update = (msg: any) => {
          if (isThrottled) {
            tempMsg = msg
            throtDebounced = true
          } else {
            isThrottled = true
            setTimeout(() => {
              if (throtDebounced && !channel.isDestroyed) {
                updateChannelListener(server, channel, tempMsg)
                // deref
                tempMsg = null
              }
              throtDebounced = false
              isThrottled = false
            }, spec.throttle)
            updateChannelListener(server, channel, msg)
          }
        }

        channel.closeFunction = spec.subscriber(
          server.client,
          payload,
          id,
          update,
          (err) => errorChannelListener(server, channel, err),
        )
      } else {
        channel.closeFunction = spec.subscriber(
          server.client,
          payload,
          id,
          (msg) => updateChannelListener(server, channel, msg),
          (err) => errorChannelListener(server, channel, err),
        )
      }
    } catch (err) {
      errorChannelListener(server, channel, err)
    }
  }
}
