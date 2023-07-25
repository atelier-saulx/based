import crossFetch from 'cross-fetch'

let f: typeof crossFetch
// @ts-ignore
if (!!global.WebSocketPair) {
	// @ts-ignore
	f = global.Fetch
} else {
	// @ts-ignore
	f = crossFetch
}

export default f
