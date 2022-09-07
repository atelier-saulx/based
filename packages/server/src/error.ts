export enum BasedErrorCode {
  FunctionError = 50001,
}
export type BasedErrorData = {
  message: string
  stack: string
  requestId?: number
  basedCode: BasedErrorCode
  code?: string
}

export const generateErrorData = (
  error: Error,
  basedErrorCode: BasedErrorCode,
  extraProps?: Partial<BasedErrorData>
): BasedErrorData => {
  const errorData = { message: null, stack: null, basedCode: null }
  Object.getOwnPropertyNames(error).forEach((key: string) => {
    errorData[key] = error[key]
  })
  return {
    ...errorData,
    ...(basedErrorCode ? { basedCode: basedErrorCode } : null),
    ...extraProps,
  }
}
