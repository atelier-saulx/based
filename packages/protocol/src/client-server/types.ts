export enum FunctionServerType {
  function = 0,
  subscribe = 1,
  unsubscribe = 2,
  get = 3,
  auth = 4,
  channelSubscribe = 5,
  channelPublish = 6,
  subType = 7,
}

export enum FunctionServerSubType {
  channelUnsubscribe = 0,
  registerStream = 1,
  chunk = 2,
}

export enum FunctionClientType {
  function = 0,
  subscriptionData = 1,
  subscriptionDiff = 2,
  get = 3,
  auth = 4,
  error = 5,
  rePublishChannelName = 6,
  subType = 7,
}

export enum FunctionClientSubType {
  channel = 0,
  streamFullResponse = 1,
  streamChunkResponse = 2,
  forceReload = 3,
}
