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

/*
TODO
- chunk encoding
- chunk reciever - and helper
- sending binary to subscribe from client
- binary ping (empty byte)

- global clients / av outgoing bytes 
- max bytes 300mb outgoing 8k users max

- 37500 / 10 maybe? (3.7kb max) 
- lets first just do chunks allways on this size - later we do more variable

- number and methods in observables to change chunk size
- more shared things between shared and normal subscribe (and configuration)

*/
