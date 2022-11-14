import { parentPort } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'
import httpFunction from './http/function'
import { addFunction, removeFunction, errorInstallFunction } from './functions'
import { incomingAuthorize } from './authorize'
import { incomingObserve } from './api'
import { IncomingMessage } from './types'

parentPort.on('message', (msg: IncomingMessage) => {
  if (msg.type === 0) {
    addFunction(msg.name, msg.path)
    wsFunction(msg)
    return
  }

  if (msg.type === 1) {
    addFunction(msg.name, msg.path)
    createObs(msg)
    return
  }

  if (msg.type === 2) {
    closeObs(msg.id)
    return
  }

  if (msg.type === 3) {
    addFunction(msg.name, msg.path)
    httpFunction(msg)
    return
  }

  if (msg.type === 4) {
    addFunction(msg.name, msg.path)
    return
  }

  if (msg.type === 5) {
    removeFunction(msg.name)
    return
  }

  if (msg.type === 6) {
    errorInstallFunction(msg.name)
    return
  }

  if (msg.type === 7) {
    incomingObserve(msg)
    return
  }

  if (msg.type === 8) {
    incomingAuthorize(msg)
  }
})
