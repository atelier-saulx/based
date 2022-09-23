import mimeTypes from 'mime-types'

export default (mimeType: string) => {
  const [mime, type] = mimeType.split('/')
  if (mime === 'font') {
    return 'woff'
  } else if (type === 'mp3') {
    return 'mp3'
  } else if (type === 'woff2') {
    return 'woff2'
  } else {
    return mimeTypes.extension(mimeType)
  }
}
