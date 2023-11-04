import nFetch from 'node-fetch'
let fetchP = nFetch
if ('fetch' in global) {
	fetchP = fetch
}
export default fetchP
