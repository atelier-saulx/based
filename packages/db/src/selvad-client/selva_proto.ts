import { compile } from 'data-record'

// TODO Automagicaally match with the C code?
export const selvaError = [
    "ERR_SELVA No Error",
    "ERR_SELVA EGENERAL Unknown error",
    "ERR_SELVA ENOTSUP Operation not supported",
    "ERR_SELVA EINVAL Invalid argument or input value",
    "ERR_SELVA ERANGE Result too large",
    "ERR_SELVA EINTYPE Invalid type",
    "ERR_SELVA ENAMETOOLONG Name too long",
    "ERR_SELVA ENOMEM Out of memory",
    "ERR_SELVA ENOENT Not found",
    "ERR_SELVA EEXIST Exist",
    "ERR_SELVA EACCES Permission denied",
    "ERR_SELVA ENOBUFS No buffer or resource space available",
    "ERR_SELVA EINPROGRESS Operation in progress",
    "ERR_SELVA Input/output error",
    "ERR_SELVA Timed out",
    "ERR_PROTO EALREADY Operation already in progress",
    "ERR_PROTO ENOTSUP Operation not supported",
    "ERR_PROTO EINVAL Invalid argument/input value",
    "ERR_PROTO EINTYPE Invalid type",
    "ERR_PROTO ENOMEM Out of memory",
    "ERR_PROTO ENOENT Node or entity not found",
    "ERR_PROTO EEXIST Entity already exist",
    "ERR_PROTO ENOBUFS No buffer or resource space available",
    "ERR_PROTO EBADMSG Bad message",
    "ERR_PROTO EBADF Not a valid open file descriptor",
    "ERR_PROTO ECONNRESET Connection reset by peer",
    "ERR_PROTO ENOTCONN The socket is not connected",
    "ERR_PROTO EPIPE The local end has been shutdown",
    "ERR_HIERARCHY EGENERAL Unknown error",
    "ERR_HIERARCHY ENOTSUP Operation not supported",
    "ERR_HIERARCHY EINVAL Invalid argument or input value",
    "ERR_HIERARCHY ENOMEM Out of memory",
    "ERR_HIERARCHY ENOENT Not found",
    "ERR_HIERARCHY EEXIST Exist",
    "ERR_HIERARCHY ETRMAX Maximum number of recursive find calls reached",
    "ERR_SUBSCRIPTIONS EGENERAL Unknown error",
    "ERR_SUBSCRIPTIONS EINVAL Invalid argument or input value",
    "ERR_SUBSCRIPTIONS ENOMEM Out of memory",
    "ERR_SUBSCRIPTIONS ENOENT Not found",
    "ERR_SUBSCRIPTIONS EEXIST Exist",
    "ERR_RPN ECOMP Expression compilation failed",
    "ERROR_SELVA_OBJECT Maximum number of keys reached",
    "ERROR_SELVA_OBJECT Precondition mismatch or failed",
    "ERR_SELVA Invalid error code",
]

export const SELVA_PROTO_NULL = 0 /*!< A null. */
export const SELVA_PROTO_ERROR = 1 /*!< An error message. */
export const SELVA_PROTO_DOUBLE = 2 /*!< A double value. */
export const SELVA_PROTO_LONGLONG = 3 /*!< A 64-bit integer value. */
export const SELVA_PROTO_STRING = 4 /*!< A string or binary blob. */
export const SELVA_PROTO_ARRAY = 5 /*!< Begin an array. */
export const SELVA_PROTO_ARRAY_END = 6 /*!< Terminates an array of unknown length. Uses selva_proto_control. */
export const SELVA_PROTO_REPLICATION_CMD = 7 /*!< A replication message. */
export const SELVA_PROTO_REPLICATION_SDB = 8 /*!< A replication db dump message. */

export const SELVA_PROTO_STRING_FBINARY = 0x01 /*!< Expect binary data. */
export const SELVA_PROTO_STRING_FDEFLATE = 0x02 /*!< Compressed with deflate. */

export const SELVA_PROTO_ARRAY_FPOSTPONED_LENGTH = 0x80 /*!< Start an array of unknown length and terminate it with a special token. */
export const SELVA_PROTO_ARRAY_FLONGLONG = 0x01 /*!< A fixed size long long array follows. No encapsulation is used. */
export const SELVA_PROTO_ARRAY_FDOUBLE = 0x02 /*!< A fixed size double array follows. No encapsulation is used. */
