// Dont import this in the browser!
// for publish
// https://github.com/uNetworking/uWebSockets.js/blob/61fa4bd06cf9db078716dc0c70bc5e8274d742f6/examples/PubSub.js

/*
Protocol
| TYPE 1 | CHUNKS 2 | SIZE? 4 | ERROR? |

if (chunk === 0) & SIZE -> ERROR
*/

export { encodeSubData } from './encodeSubData'
export { decode } from './decode'
export { encodeSubDiffData } from './encodeSubDiffData'
