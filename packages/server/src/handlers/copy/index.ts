import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestMessage, RequestTypes, Copy } from '@based/client'
import { hashCompact } from '@saulx/hash'

export const copy = async (
  server: BasedServer,
  payload: Copy
): Promise<{ ids: string[] }> => {
  const query: any = {
    $id: payload.$id,
    $all: true,
  }

  if (payload.db) {
    query.$db = payload.db
  }

  if (payload.deep) {
    query.children = true
    query.allChildren = {
      $all: true,
      parents: {
        id: true,
        $list: true,
      },
      children: true,
      $list: {
        $find: {
          $traverse: 'descendants',
        },
      },
    }
  }

  if (!payload.parents) {
    query.parents = {
      id: true,
      $list: true,
    }
  }

  let r
  try {
    r = await server.db.get(query)
  } catch (err) {
    err.name = 'CopyGetError'
    throw err
  }

  const setObj: any = {
    type: r.type,
    parents: r.parents ? r.parents.map((v) => v.id) : payload.parents,
  }

  if (payload.db) {
    setObj.$db = payload.db
  }

  const addedChildren = {}

  const allChildren = r.allChildren

  const setObjects = []

  const copyIt = (setObj, obj, topLevel = false): any => {
    setObjects.push(setObj)

    if (payload.deep) {
      addedChildren[obj.id] = setObj
      setObj.$id =
        obj.id.slice(0, 2) +
        hashCompact(
          obj.id.slice(2, -1) + Math.floor(Math.random() * 999999999) + 'copy'
        )
    }

    if (!setObj.parents) {
      setObj.parents = []
    }

    if (!topLevel) {
      if (obj.parents) {
        for (const p of obj.parents) {
          let s = addedChildren[p.id]
          if (!s) {
            const getObj = allChildren.find((v) => v.id === p.id)
            if (getObj) {
              s = copyIt({}, getObj, false)
              setObj.parents.push(s.$id)
              // same so lets find it
            } else {
              setObj.parents.push(p.id)
            }
          } else {
            setObj.parents.push(s.$id)
          }
        }
      }
    }

    if (payload.db) {
      setObj.$db = payload.db
    }

    for (const f in obj) {
      if (
        f === 'parents' ||
        f === 'allChildren' ||
        f === 'id' ||
        (payload.excludeFields && payload.excludeFields.find((v) => v === f))
      ) {
        continue
      }
      if (f === 'children') {
        for (const id of obj.children) {
          if (!addedChildren[id]) {
            const getObj = allChildren.find((v) => v.id === id)
            copyIt({}, getObj, false)
          }
        }
      } else if (f === 'name') {
        setObj.name = obj[f] + ' copy'
      } else {
        setObj[f] = obj[f]
      }
    }

    return setObj
  }

  copyIt(setObj, r, true)

  // TODO: ordering setObjects on most efficient parents

  const ids = await Promise.all(setObjects.map((s) => server.db.set(s)))

  // @ts-ignore
  return { ids: ids }
}

export default async (
  server: BasedServer,
  client: Client,
  [, reqId, payload]: RequestMessage
) => {
  // can do a check for subscriptions
  try {
    const r = await copy(server, <Copy>payload)
    client.send([RequestTypes.Copy, reqId, r])
  } catch (err) {
    client.send([
      RequestTypes.Copy,
      reqId,
      0,
      { type: 'ValidationError', name: 'copy', message: err.message, payload },
    ])
  }
}
