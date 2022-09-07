export enum BasedErrorCode {
  FunctionError = 50001,
}

export type BasedErrorData = {
  message: string
  stack: string
  requestId?: number
  basedCode: BasedErrorCode
  statusCode?: number
}

// TODO: Bellow functions should go to the fluffy client
export class BasedError extends Error {
  public message: string
  public stack: string
  public code?: string
  public basedCode?: BasedErrorCode
}

export const convertDataToBasedError = (
  payload: BasedErrorData
): BasedError => {
  const { message, requestId, ...otherProps } = payload
  const error = new BasedError(payload.message)
  Object.keys(otherProps).forEach((key) => {
    error[key] = otherProps[key]
  })
  return error
}
