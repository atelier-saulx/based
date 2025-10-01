export const isDisconnectedError = (e: Error) => {
    return e.message?.includes('Server disconnected before function result was processed')
}

export const disconnectRetryStrategy = (err: Error, _time: number, retries: number) => {
    if (isDisconnectedError(err) && retries < 1) {
        return 0
    }
    return false
}

