import { BasedDb } from '@based/db'

export type SnapShotWriteResult = {
  [eventId: string]: {
    size: number
    geo: {
      [geo: string]: {
        uniq: number
        count: number
        active: number
      }
    }
  }
}

export type CurrentId = number

export type AnalyticsDbCtx = {
  db: BasedDb
  populateConfig: () => Promise<void>
  eventTypes: { [event: string]: number }
  eventTypesInverse: { [event: number]: string }

  currents: {
    [eventId: string]: {
      geos: {
        [geo: string]: { active: number; id: CurrentId }
      }
      lastSnapshot: number
      lastSnapshotId: number
    }
  }

  currentsActivePerClient: {
    [clientId: string]: {
      [eventId: string]: {
        geos: {
          [geo: string]: number
        }
      }
    }
  }

  prevWriteResult?: SnapShotWriteResult
  close: () => Promise<void>
  closers: (() => void)[]
  config: {
    snapShotInterval: number
  }
}

export type SnapShotResult = {
  [event: string]: any[]
}

export type TrackPayload = {
  event: string
  geo?: string
  uniq?: string
}

export type DbTrackPayload = {
  event: string
  uniq?: Uint8Array[]
  active?: number
  geo: string
  count: number
}

export type ClientCtx = {
  close: () => void
  flushTime: number
  events: {
    [eventName: string]: {
      geos: {
        [geo: string]: {
          count: number
          uniq?: Set<string | number>
        }
      }
    }
  }
  activeEvents: {
    [eventName: string]: {
      geos: {
        [geo: string]: {
          active: number
          // prevActive: number
        }
      }
    }
  }
}
