import {
  RequestTypes,
  Message,
  generateSubscriptionId,
  TrackMessage,
} from '@based/client'

// const methodNotAllowedResponse = (res) => {
//   res
//     .writeStatus('405 Method Not Allowed')
//     .writeHeader('Allow', 'POST')
//     .end(`{"code":405,"message":"Method Not Allowed"}`)
// }

const getReqType = (name: string[]): RequestTypes => {
  if (name[1] === 'call' && name[2]) {
    return RequestTypes.Call
  } else if (name[1] === 'set') {
    return RequestTypes.Set
  } else if (name[1] === 'get') {
    if (!name[2]) {
      return RequestTypes.Get
    } else {
      return RequestTypes.GetSubscription
    }
  } else if (name[1] === 'track') {
    return RequestTypes.Track
  } else if (name[1] === 'copy') {
    return RequestTypes.Copy
  } else if (name[1] === 'delete') {
    return RequestTypes.Delete
  } else if (name[1] === 'digest') {
    return RequestTypes.Digest
  } else if (name[1] === 'configuration' || name[1] === 'schema') {
    return RequestTypes.GetConfiguration
  } else if (
    name[1] === 'configure' ||
    name[1] === 'update-schema' ||
    name[1] === 'updateSchema'
  ) {
    return RequestTypes.Configuration
  } else if (name[1] === 'digest') {
    return RequestTypes.Digest
  }
}

export default (name: string[], payload?: any): Message | TrackMessage => {
  const type = getReqType(name)
  if (type === RequestTypes.Call) {
    let path = ''
    for (let i = 3; i < name.length; i++) {
      path += `/${name[i]}`
    }
    return [type, name[2], 0, payload, path || '/']
  } else if (type === RequestTypes.Set) {
    return [type, 0, payload]
  } else if (type === RequestTypes.Track) {
    return [type, payload]
  } else if (type === RequestTypes.Get) {
    return [type, 0, payload]
  } else if (type === RequestTypes.GetSubscription) {
    return [
      RequestTypes.GetSubscription,
      generateSubscriptionId(payload, name[2]),
      payload,
      0,
      name[2],
    ]
  } else if (type === RequestTypes.GetConfiguration) {
    return [RequestTypes.GetConfiguration, 0, payload]
  } else if (type === RequestTypes.Delete) {
    return [RequestTypes.Delete, 0, payload]
  } else if (type === RequestTypes.Copy) {
    return [RequestTypes.Copy, 0, payload]
  } else if (type === RequestTypes.Configuration) {
    return [RequestTypes.Configuration, 0, payload]
  } else if (type === RequestTypes.Digest) {
    return [RequestTypes.Digest, 0, payload]
  }
}
