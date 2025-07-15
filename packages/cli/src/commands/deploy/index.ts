import { getBasedClient } from '../../getBasedClient.js'
import { parseFolder, watch } from './bundle.js'

export const deploy = async () => {
  console.log('this is deploy')

  // const basedClient = await getBasedClient()
  // const remoteFunctions = (await basedClient
  //   .query('db', {
  //     $db: 'config',
  //     functions: {
  //       id: true,
  //       current: {
  //         id: true,
  //         config: true,
  //         checksum: true,
  //       },
  //       $list: {
  //         $find: {
  //           $traverse: 'children',
  //           $filter: {
  //             $field: 'type',
  //             $operator: '=',
  //             $value: ['job', 'function'],
  //           },
  //         },
  //       },
  //     },
  //   })
  //   .get()) as {
  //   functions: {
  //     id?: string
  //     current?: {
  //       id: string
  //       config: any
  //       checksum: number
  //     }
  //   }[]
  // }
  //
  // console.log({ remoteFunctions })

  const results = await parseFolder()
  console.log({ results })
  // watch(results)

  // basedClient.destroy()
}
