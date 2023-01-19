import { BasedClient } from '../../'
import getUrlFromOpts from '../../getUrlFromOpts'

// import fetch from 'cross-fetch'
// also xhr http request

const DEBOUNCE_TIME = 100

// first nodejs
export const drain = (client: BasedClient) => {
  console.info('GO DRAIN NODE JS')
  // can just use interfaces with ts ofc...

  // connect to same server?
  // if client is connected - no get url

  if (!client.isDrainingStreams) {
    client.isDrainingStreams = true
    setTimeout(async () => {
      const url = await getUrlFromOpts(client.opts)
      client.isDrainingStreams = false
      console.info('go drain', url)
      // go go go
    }, DEBOUNCE_TIME)
  }
}
