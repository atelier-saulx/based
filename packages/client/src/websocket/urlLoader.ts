export default (
  url: string | (() => Promise<string>),
  cb: (url: string) => void
) => {
  if (typeof url === 'function') {
    url().then((v) => {
      cb(v)
    })
  } else {
    cb(url)
  }
}
