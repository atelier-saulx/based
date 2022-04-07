import { Data, Loading } from './types'

export function resultReducer(
  state: { data: Data; error?: Error; loading: Loading; checksum: number },
  action: {
    merge?: Data
    data?: Data
    error?: Error
    loading?: Loading
    checksum?: number
  }
) {
  if (action.error) {
    state.error = action.error
  }
  if (action.data) {
    state.checksum = action.checksum || 0
    state.data = action.data
    state.loading = false
    if (state.error) {
      delete state.error
    }
  }

  if (action.merge) {
    state.checksum = action.checksum || 0
    if (!state.data) {
      state.data = action.merge
    } else {
      Object.assign(state.data, action.merge)
    }
    state.loading = false
    if (state.error) {
      delete state.error
    }
  }

  if (action.loading) {
    state.loading = action.loading
  }
  return { ...state }
}
