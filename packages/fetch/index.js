import nFetch from 'node-fetch'
let fetchP = nFetch
if (!!global.WebSocketPair || 'fetch' in global) {
  fetchP = fetch
}
export default fetchP
