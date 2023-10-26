import { SchemaMutations } from "../types";
import { BasedDbClient } from "..";
import { getValueByPath, pathToQuery } from "../util";

type MutationHandler = (oldValue: any) => any

const defaultMutationHandlers: {
  [name: string]: MutationHandler
} = {
  'number-string': (oldValue) => String(oldValue)
}

const PAGE_AMOUNT = 3e3
export const migrateNodes = async (client: BasedDbClient, mutations: SchemaMutations) => {
  for (const mutation of mutations) {
    if (mutation.mutation === 'delete_type') {
      let finished = false
      while (!finished) {
        const nodeDeletions = []
        const query = {
          ids: {
            id: true,
            $list: {
              $limit: PAGE_AMOUNT,
              $find: {
                $traverse: 'descendants',
                $filter: {
                  $field: 'type',
                  $operator: '=',
                  $value: mutation.type
                }
              }
            }
          }
        }
        const result = await client.get(query)
        const ids = result.ids?.map((node: any) => node.id) || []
        ids.forEach((id: string) => {
          nodeDeletions.push(client.delete({ $id: id, $recursive: true }))
        })
        await Promise.all(nodeDeletions)
        if (ids.length < PAGE_AMOUNT) {
          finished = true
        }
      }
    }

    if (mutation.mutation === 'remove_field') {
      let finished = false
      let page = 0
      while (!finished) {
        const nodeDeletions = []
        const query = {
          ids: {
            id: true,
            $list: {
              $offset: page * PAGE_AMOUNT,
              $limit: PAGE_AMOUNT,
              $find: {
                $traverse: 'descendants',
                $filter: {
                  $field: 'type',
                  $operator: '=',
                  $value: mutation.type
                }
              }
            }
          }
        }
        const ids = (await client.get(query)).ids?.map((node: any) => node.id)
        if (ids) {
          ids.forEach((id: string) => {
            nodeDeletions.push(client.set({
              $id: id,
              [mutation.path[0]]: {
                $delete: true
              }
            }))
          })
          await Promise.all(nodeDeletions)
          if (ids.length === PAGE_AMOUNT) {
            page++
          } else {
            finished = true
          }

        } else {
          finished = true
        }
      }
    }

    if (mutation.mutation === 'change_field') {
      // console.log('------', mutation)
      let finished = false
      let page = 0
      while (!finished) {
        console.log('---==---', page)
        const nodeGets = []
        const query = {
          ids: {
            id: true,
            $list: {
              $offset: page * PAGE_AMOUNT,
              $limit: PAGE_AMOUNT,
              $find: {
                $traverse: 'descendants',
                $filter: [{
                  $field: 'type',
                  $operator: '=',
                  $value: mutation.type
                },
                {
                  $field: mutation.path.join('.'),
                  $operator: 'exists'
                }
                ]
              }
            }
          }
        }
        const ids = (await client.get(query)).ids?.map((node: any) => node.id)
        if (ids) {
          ids.forEach((id: string) => {
            const query = {
              $id: id,
              ...pathToQuery(mutation.path, true)
            }
            nodeGets.push(client.get(query))
          })
          const results = await Promise.all(nodeGets)
          const lowLevelSets = []
          ids.forEach((id: string, index: number) => {
            let oldValue = getValueByPath(results[index], mutation.path)
            let newValue: any
            try {
              newValue = defaultMutationHandlers[`${mutation.old.type}-${mutation.new.type}`](oldValue)
            } catch (error) {
              console.warn(`Error running migration handler for ${id} on field ${mutation.path.join('.')}`)

            }
            lowLevelSets.push(client.command('object.set', [
              id,
              mutation.path.join('.'),
              's', // TODO: Change depending
              newValue
            ]))
          })

          await Promise.all(lowLevelSets)

          if (ids.length === PAGE_AMOUNT) {
            page++
          } else {
            finished = true
          }

        } else {
          finished = true
        }
      }
    }
  }
}
