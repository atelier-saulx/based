const { observe } = require('@based/edge-server/worker')

/*
 name: string,
  payload: any,
  context: ClientContext,
  onData: ObservableUpdateFunction,
  onError?: ObserveErrorListener
*/

// async and non async support
module.exports = (payload, update) => {
  return observe('obsWithNested', 'json', {}, update)
}
