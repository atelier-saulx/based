import { BasedClient } from '..'

import { Query } from '@based/types'

import {
  addSubscriber,
  generateSubscriptionId,
  removeSubscriber,
} from '../subscriptions'

interface ISubscription {
  unsubscribe()
}

class Subscription implements ISubscription {
  private subscriberId: number
  private client: BasedClient
  private subId: number
  constructor(client: BasedClient, subscriberId: number, subId: number) {
    this.client = client
    this.subId = subId
    this.subscriberId = subscriberId
  }

  unsubscribe() {
    this.closed = true
    removeSubscriber(this.client, this.subId, this.subscriberId)
  }

  public closed: boolean = false
}

class CompoundSubscription implements ISubscription {
  private client: BasedClient
  private subs: ISubscription[]

  constructor(client: BasedClient, subs: ISubscription[]) {
    this.client = client
    this.subs = subs
  }

  unsubscribe() {
    if (this.closed) {
      return
    }

    this.closed = true

    for (const sub of this.subs) {
      sub.unsubscribe()
    }
  }

  public closed: boolean = false
}

type UpdateCallback = (value: any, checksum?: number) => void

export interface IObservable {
  subscribe(
    onNext: UpdateCallback,
    onError?: (err: Error) => void,
    onComplete?: (x?: any) => void
  ): ISubscription
}

export class CompoundObservable implements IObservable {
  private client: BasedClient
  private components: { key: string; obs: Observable }[]

  constructor(
    client: BasedClient,
    components: { key: string; obs: IObservable }[]
  )

  constructor(
    client: BasedClient,
    components: { key: string; obs: Observable }[]
  ) {
    this.client = client
    this.components = components
  }

  subscribe(
    onNext: UpdateCallback,
    onError?: (err: Error) => void,
    onComplete?: (x?: any) => void
  ): ISubscription {
    const sharedResult: any = { data: {} }
    const subs: ISubscription[] = []
    for (const { key, obs } of this.components) {
      const sub = obs.subscribe((d) => {
        if (key === '') {
          Object.assign(sharedResult.data, d)
          onNext(sharedResult)
          return
        }

        sharedResult.data[key] = d
        onNext(sharedResult)
      }, onError)

      subs.push(sub)
    }

    return new CompoundSubscription(this.client, subs)
  }

  // Returns itself
  // [Symbol.observable]() : Observable;

  // Converts items to an Observable
  // static of(...items) : Observable;

  // Converts an observable or iterable to an Observable
  // static from(observable) : Observable;
}

export class Observable implements IObservable {
  private client: BasedClient

  private subId: number

  private name: string

  private payload: any

  constructor(client: BasedClient, name: string, payload?: any)

  constructor(client: BasedClient, query: Query)

  constructor(client: BasedClient, a: Query | string, b?: any) {
    this.client = client
    this.subId =
      typeof a === 'string'
        ? generateSubscriptionId(b, a)
        : generateSubscriptionId(a)

    this.name = typeof a === 'string' ? a : null
    this.payload = typeof a === 'string' ? b : a
  }

  subscribe(
    onNext: UpdateCallback,
    onError?: (err: Error) => void,
    onComplete?: (x?: any) => void
  ): ISubscription {
    const [, subscriberId] = addSubscriber(
      this.client,
      this.payload,
      onNext,
      (err) => {
        if (err) {
          console.error(err)
          if (onError) {
            onError(err)
          }
        }
      },
      onError,
      this.subId,
      this.name
    )
    return new Subscription(this.client, subscriberId, this.subId)
  }

  // Returns itself
  // [Symbol.observable]() : Observable;

  // Converts items to an Observable
  // static of(...items) : Observable;

  // Converts an observable or iterable to an Observable
  // static from(observable) : Observable;
}
