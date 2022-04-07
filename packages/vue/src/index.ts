/* eslint-disable @typescript-eslint/no-unused-vars */
import based, {
  Based,
  GenericObject,
  Query,
  addSubscriber,
  removeSubscriber,
  generateSubscriptionId,
  BasedOpts,
} from '@based/client'
import { inject, onUnmounted, ref, Ref, watch, getCurrentInstance } from 'vue'

export const basedKey = 'based'

export function useClient(key = null): BasedVue {
  return inject(key !== null ? key : basedKey)
}

export class BasedVue extends Based {
  install(app, injectKey) {
    app.provide(injectKey || basedKey, this)
    app.config.globalProperties.based = this
    // app.component('BasedQuery', BasedQuery)
  }
}

export const createClient = (opts: BasedOpts) => {
  const client = based(opts, BasedVue)
  return client
}

type Data = GenericObject

type Loading = boolean

const addObserver = (
  query,
  subId,
  loading,
  data,
  error,
  subscriberId,
  client
) => {
  const q = query.value

  console.info('xxxxxx', q, q.name)

  if (q && (q.q || q.name)) {
    const id = generateSubscriptionId(q.q, q.name)
    if (id !== subId.value) {
      if (subscriberId.value) {
        removeSubscriber(client.client, subId.value, subscriberId.value)
      }
      subId.value = id
      const [, sId] = addSubscriber(
        client.client,
        q.q,
        (d, c) => {
          loading.value = false
          data.value = { ...d }
        },
        (err) => {
          error.value = err
        },
        (err) => {
          error.value = err
        },
        subId.value,
        q.name || undefined
      )
      subscriberId.value = sId
    }
  } else {
    // nothing
  }
}

export function useData(query: Query): {
  data: Ref<Data>
  error?: Ref<Error>
  loading: Ref<Loading>
}

export function useData(
  name: string,
  payload: any
): {
  data: Ref<Data>
  error?: Ref<Error>
  loading: Ref<Loading>
}

export function useData(
  a: string | Query,
  payload?: any
): {
  data: Ref<Data>
  error?: Ref<Error>
  loading: Ref<Loading>
} {
  const isString = typeof a === 'string'
  const query = ref({
    q: isString ? payload : a,
    name: isString ? a : undefined,
  })
  const subId = ref(0)
  const loading = ref(true)
  const data = ref({})
  const error = ref(null)
  const subscriberId = ref(0)
  const client = useClient()

  // reactive

  // xyz
  if (!getCurrentInstance()) {
    throw new Error('Do not use useData outside of setup')
  }

  onUnmounted(() => {
    if (subscriberId.value) {
      removeSubscriber(client.client, subId.value, subscriberId.value)
    }
  })

  watch(
    query,
    () => {
      addObserver(query, subId, loading, data, error, subscriberId, client)
    },
    { deep: true }
  )

  addObserver(query, subId, loading, data, error, subscriberId, client)

  return {
    data,
    loading,
    error,
  }
}

// seems to not be the way anymore  can do this later
// export const BasedQuery = {
//   name: 'based-query',
//   props: {
//     query: Object,
//   },
//   render(p) {
//     return p.slots.default()
//   },
//   setup(props, ctx) {
//     ctx.expose(props)
//     console.info('PROPS', ctx, props)
//     // const d = useData(props.query)
//     return {
//       x: 'Flap',
//       slots: ctx.slots,
//     }
//   },
// }
