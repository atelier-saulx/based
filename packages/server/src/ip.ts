import uws from '@based/uws'

export const getIp = (res: uws.HttpResponse): string => {
  return Buffer.from(res.getRemoteAddressAsText()).toString()
}
