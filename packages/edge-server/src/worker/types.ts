// 0 FN
// 1 CREATE OBS
// 2 CLOSE OBS
// 3 HTTP POST FN
// 4 HTTP GET FN
// 5 FN INSTALLED (can be observable as well)
// 6 UNINSTALL FN
// 7 CANNOT INSTALL FN
// 8 OBSERVABLE UPDATE
// 9 AUTHORIZE

import { ClientContext } from '../types'

export type Incoming = {
  // 0
  Fn: {
    type: 0
  }

  // 1
  CreateObs: {
    type: 1
  }

  // 2
  CloseObs: {}

  // 3
  FnPost: {}

  // 4
  FnGet: {}

  // 5
  AddFn: {}

  // 6
  RemoveFn: {}

  // 7
  InstallFnError: {}

  // 8
  UpdateObs: {}

  // 9
  Authorize: {
    context: ClientContext
    name: string
    payload?: any
  }
}

export type IncomingMessage = Incoming[keyof Incoming]

export type Outgoing = {
  // 0
  InstallFn: {}
  // 1
  Subscribe: {}
  // 2
  Unsubscribe: {}
  // 3
  Get: {}
  // 4
  Log: {}
  // 5
  Error: {}
}
