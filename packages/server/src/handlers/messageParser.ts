import { BasedServer } from '..'
import set from './set'
import bulkUpdate from './bulkUpdate'
import copy from './copy'
import track from './track'
import get from './get'
import removeType from './removeType'
import removeField from './removeField'
import digest from './digest'
import del from './delete'
import configure from './configure'
import getConfig from './getConfig'
import call from './functions/call'
import * as fns from './functions/observable'
import * as cfg from './configuration'
import { subscribe, sendSubscriptionData, unsubscribe } from './subscription'
import { RequestTypes, Message, TrackMessage } from '@based/client'
import { Client } from '../Client'
import userAuth from './userAuth'

export default (
  server: BasedServer,
  client: Client,
  messages: (Message | TrackMessage)[]
) => {
  for (const msg of messages) {
    if (msg[0] === RequestTypes.RemoveField) {
      removeField(server, client, msg)
    } else if (msg[0] === RequestTypes.RemoveType) {
      removeType(server, client, msg)
    } else if (msg[0] === RequestTypes.Copy) {
      copy(server, client, msg)
    } else if (msg[0] === RequestTypes.Digest) {
      digest(server, client, msg)
    } else if (msg[0] === RequestTypes.Call) {
      call(server, client, msg)
    } else if (msg[0] === RequestTypes.Auth) {
      userAuth(server, client, msg)
    } else if (msg[0] === RequestTypes.GetConfiguration) {
      getConfig(server, client, msg)
    } else if (msg[0] === RequestTypes.Configuration) {
      configure(server, client, msg)
    } else if (msg[0] === RequestTypes.Get) {
      get(server, client, msg)
    } else if (msg[0] === RequestTypes.Delete) {
      del(server, client, msg)
    } else if (msg[0] === RequestTypes.Set) {
      set(server, client, msg)
    } else if (msg[0] === RequestTypes.BulkUpdate) {
      bulkUpdate(server, client, msg)
    } else if (msg[0] === RequestTypes.Track) {
      track(server, client, msg)
    } else if (msg[0] === RequestTypes.GetSubscription) {
      if (msg[4] === '$configuration') {
        cfg.getObservable(server, client, msg)
      } else if (msg[4]) {
        fns.getObservable(server, client, msg)
      } else {
        console.warn('🔥  Get not implemented for normal observables...')
      }
    } else if (msg[0] === RequestTypes.Subscription) {
      if (msg[5] === '$configuration') {
        cfg.subscribeObservable(server, client, msg)
      } else if (msg[5]) {
        fns.subscribeObservable(server, client, msg)
      } else {
        subscribe(server, client, msg)
      }
    } else if (msg[0] === RequestTypes.SendSubscriptionData) {
      sendSubscriptionData(server, client, msg)
    } else if (msg[0] === RequestTypes.Unsubscribe) {
      unsubscribe(server, client, msg)
    } else {
      // illegal request abort
      client.destroy()
      break
    }
  }
}
