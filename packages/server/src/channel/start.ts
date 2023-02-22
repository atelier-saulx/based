import { BasedServer } from '../server'
import { isChannelFunctionSpec } from '../functions'
import { ActiveChannel } from './types'
import {
  valueToBuffer,
  encodeChannelMessage,
  encodeErrorResponse,
} from '../protocol'
import { BasedErrorData, BasedErrorCode, createError } from '../error'

const updateChannelListener = (
  server: BasedServer,
  channel: ActiveChannel,
  msg: any
) => {
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
  err: Error | BasedErrorData<BasedErrorCode.FunctionError>
) => {
  err =
    err instanceof Error
      ? createError(
          server,
          { session: { type: 'channel', id: channel.id, name: channel.name } },
          BasedErrorCode.FunctionError,
          {
            err,
            observableId: channel.id,
            route: {
              name: channel.name,
            },
          }
        )
      : err.observableId !== channel.id
      ? { ...err, observableId: channel.id }
      : err

  if (channel.clients.size) {
    server.uwsApp.publish(
      String(channel.id),
      encodeErrorResponse(valueToBuffer(err)),
      true,
      false
    )
  }
  if (channel.functionChannelClients.size) {
    // TODO: later
    // channel.functionChannelClients.forEach((fnUpdate) => {
    //   fnUpdate(msg)
    // })
  }
}

export const startChannel = (
  server: BasedServer,
  id: number,
  fromInstall?: boolean
) => {
  const channel = server.activeChannelsById.get(id)

  if (channel.closeFunction) {
    channel.closeFunction()
    delete channel.closeFunction
  }

  const spec = server.functions.specs[channel.name]

  const payload = channel.payload

  if (!spec || !isChannelFunctionSpec(spec)) {
    console.warn(
      'Start channel - cannot find channel function spec',
      channel.name
    )
    return
  }

  if (!fromInstall || channel.isActive) {
    channel.isActive = true
    try {
      channel.closeFunction = spec.function(server.client, payload, id, (msg) =>
        updateChannelListener(server, channel, msg)
      )
    } catch (err) {
      errorChannelListener(server, channel, err)
    }
  }
}
