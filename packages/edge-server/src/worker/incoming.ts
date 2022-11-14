import { parentPort } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'
import httpFunction from './http/function'
import { addFunction, removeFunction, errorInstallFunction } from './functions'
import { incomingAuthorize } from './authorize'
import { incomingObserve } from './api'
import { IncomingMessage, IncomingType } from './types'

parentPort.on('message', (msg: IncomingMessage) => {
  if (msg.type === IncomingType.WsFunction) {
    addFunction(msg.name, msg.path)
    wsFunction(msg)
    return
  }

  if (msg.type === IncomingType.CreateObs) {
    addFunction(msg.name, msg.path)
    createObs(msg)
    return
  }

  if (msg.type === IncomingType.CloseObs) {
    closeObs(msg.id)
    return
  }

  if (msg.type === IncomingType.HttpFunction) {
    addFunction(msg.name, msg.path)
    httpFunction(msg)
    return
  }

  if (msg.type === IncomingType.AddFunction) {
    addFunction(msg.name, msg.path)
    return
  }

  if (msg.type === IncomingType.RemoveFunction) {
    removeFunction(msg.name)
    return
  }

  if (msg.type === IncomingType.InstallFunctionError) {
    errorInstallFunction(msg.name)
    return
  }

  if (msg.type === IncomingType.UpdateObservable) {
    incomingObserve(msg)
    return
  }

  if (msg.type === IncomingType.Authorize) {
    incomingAuthorize(msg)
  }
})
