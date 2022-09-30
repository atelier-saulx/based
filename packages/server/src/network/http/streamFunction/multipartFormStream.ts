// import { DataStream } from './DataStream'
// import uws from '@based/uws'
// import { BasedServer } from '../../..'
// import { HttpClient } from '../../../types'
// import { BasedErrorCode } from '../../../error'
// import { sendHttpError } from '../send'
// import getExtension from './getExtension'
// // import fs from 'fs'

// // will become file not STREAM

// // make it file

// export type FileOptions = {
//   name?: string
//   raw?: boolean
//   size: number
//   type: string
//   id: string
//   extension: string
//   functionName?: string
// }

// type FileDescriptor = {
//   opts: Partial<FileOptions>
//   stream: DataStream
//   headersSet: number
// }

// // const isCompleteOpts = (
// //   options: Partial<FileOptions>
// // ): options is FileOptions => {
// //   return !!(options.id && options.size && options.type && options.extension)
// // }

// // handler for updates

// const setHeader = (
//   server: BasedServer,
//   client: HttpClient,
//   file: any
// ): boolean => {
//   file.headersSet++
//   if (file.headersSet === 2) {
//     const opts = file.opts

//     if (opts.size < 200000) {
//       file.stream.on('end', () => {
//         //   const payload: any = {
//         //     $id: opts.id,
//         //     progress: 1,
//         //     size: opts.size,
//         //   }
//         //   if (opts.name) {
//         // payload.name = opts.name
//         //   }
//         //   server.based.set(payload)
//         console.log('DONE!')
//       })
//     } else {
//       let progress = 0
//       let total = 0
//       let setInProgress = false
//       const payload: any = {
//         $id: opts.id,
//         progress: 0,
//         size: opts.size,
//       }
//       if (opts.name) {
//         payload.name = opts.name
//       }
//       //   server.based.set(payload)
//       const updateProgress = () => {
//         if (!setInProgress) {
//           setInProgress = true
//           setTimeout(() => {
//             // console.log(stream)
//             // const payload: any = {
//             //   $id: opts.id,
//             //   progress,
//             // }
//             // server.based.set(payload)
//             setInProgress = false
//           }, 250)
//         }
//       }
//       file.stream.on('end', () => {
//         // progress = 1
//         updateProgress()
//       })
//       file.stream.on('data', (chunk) => {
//         // total += chunk.byteLength
//         // progress = total / opts.size
//         updateProgress()
//       })
//     }

//     // storeFile(server, file.stream, opts)

//     return true
//   }
//   return false
// }

// const toBuffer = (str: string, firstWritten: boolean): Buffer => {
//   return Buffer.from(firstWritten ? str + '\r\n' : str, 'binary')
// }

// export default async (
//   server: BasedServer,
//   client: HttpClient
// ): Promise<void> => {
//   // multi file...

//   const files: FileDescriptor[] = []

//   let boundary = null
//   let prevLine: string
//   let isWriting = false

//   client.res.onData((chunk, isLast) => {
//     let firstWritten = false
//     const blocks = Buffer.from(chunk).toString('binary').split('\r\n')

//     if (!boundary) {
//       boundary = blocks[0]
//     }

//     for (let i = 0; i < blocks.length; i++) {
//       const line = blocks[i]

//       if (!boundary) {
//         continue
//       }

//       if (isWriting && (line === boundary || line === boundary + '--')) {
//         isWriting = false
//         const file = files[files.length - 1]
//         if (prevLine) {
//           file.stream.end(toBuffer(prevLine, firstWritten))
//         } else {
//           file.stream.end()
//         }
//         prevLine = null
//         if (line === boundary + '--') {
//           continue
//         }
//       }

//       if (line === boundary && !isWriting) {
//         const file = {
//           stream: new DataStream(),
//           headersSet: 0,
//           opts: {},
//         }

//         console.info('go go go', file)

//         files.push(file)
//         // try {
//         //   fs.unlinkSync('/Users/jim/Desktop/yes.png')
//         // } catch (err) {}
//         // file.stream.pipe(fs.createWriteStream('/Users/jim/Desktop/yes.png'))
//         continue
//       }

//       const file = files[files.length - 1]

//       if (!file) {
//         // TODO: invalid file
//         return sendHttpError(client, BasedErrorCode.InvalidPayload)
//         // return invalidFile(res)
//       }

//       if (!isWriting && line.includes('Content-Disposition')) {
//         const meta = line.match(/name="(.*?)"/)?.[1]
//         if (!meta) {
//           // TODO: invalid file
//           return sendHttpError(client, BasedErrorCode.InvalidPayload)
//         }
//         const [functionName, raw, id, size, ...name] = meta.split('|')
//         const opts = file.opts
//         opts.id = id
//         if (raw) {
//           opts.raw = true
//         }
//         if (name && name.length) {
//           opts.name = name.join('|')
//         } else {
//           opts.name = line.match(/filename="(.*?)"/)?.[1] || 'untitled'
//         }
//         if (functionName) {
//           opts.functionName = functionName
//         }
//         opts.size = Number(size)
//         isWriting = setHeader(server, client, file)
//         if (isWriting === null) {
//           return
//         }
//         continue
//       }

//       if (!isWriting && line.includes('Content-Type')) {
//         const mimeType = line.match(
//           /Content-Type: ([a-zA-Z0-9].+\/[a-zA-Z0-9].+)/
//         )?.[1]
//         if (!mimeType) {
//           // TODO: invalid file
//           return sendHttpError(client, BasedErrorCode.InvalidPayload)
//         }
//         file.opts.type = mimeType
//         // get dat extension
//         file.opts.extension = getExtension(mimeType)
//         isWriting = setHeader(server, client, file)
//         if (isWriting === null) {
//           return
//         }
//         continue
//       }

//       if (isWriting) {
//         if (prevLine) {
//           file.stream.write(toBuffer(prevLine, firstWritten))
//         }
//         prevLine = line
//         firstWritten = true
//       }
//     }

//     if (isLast) {
//       console.info('stream end')
//       // dont do this i geuss
//       //   client.res.end('{}')
//     }
//   })
// }
