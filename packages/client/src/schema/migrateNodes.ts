import { SchemaMutations } from "../types";
import { BasedDbClient } from "..";

type MigrationScript = (oldValue: any) => any

const defaultMigrationScripts: {
  [name: string]: MigrationScript
} = {
  'number-string': async (oldValue) => String(oldValue)
}

const PAGE_AMOUNT = 3e3
export const migrateNodes = async (client: BasedDbClient, mutations: SchemaMutations) => {
  for (const mutation of mutations) {
    if (mutation.mutation === 'delete_type') {
      let finished = false
      while (!finished) {
        const nodeDeletions = []
        const ids = (await client.get({
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
        })).ids.map((node: any) => node.id)
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
        const ids = (await client.get({
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
        })).ids.map((node: any) => node.id)
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
      }
    }
  }
}
