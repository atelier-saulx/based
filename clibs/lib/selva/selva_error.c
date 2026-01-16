/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */

#include "selva_error.h"

static const char * const err2str[-SELVA_INVALID_ERROR + 1] = {
    [0]                                 = (const char *)"ERR_SELVA No Error",
    [-SELVA_EGENERAL]                   = (const char *)"ERR_SELVA EGENERAL Unknown error",
    [-SELVA_ENOTSUP]                    = (const char *)"ERR_SELVA ENOTSUP Operation not supported",
    [-SELVA_EINVAL]                     = (const char *)"ERR_SELVA EINVAL Invalid argument or input value",
    [-SELVA_ERANGE]                     = (const char *)"ERR_SELVA ERANGE Result too large",
    [-SELVA_EINTYPE]                    = (const char *)"ERR_SELVA EINTYPE Invalid type",
    [-SELVA_ENAMETOOLONG]               = (const char *)"ERR_SELVA ENAMETOOLONG Name too long",
    [-SELVA_ENOMEM]                     = (const char *)"ERR_SELVA ENOMEM Out of memory",
    [-SELVA_ENOENT]                     = (const char *)"ERR_SELVA ENOENT Not found",
    [-SELVA_EEXIST]                     = (const char *)"ERR_SELVA EEXIST Exist",
    [-SELVA_EACCES]                     = (const char *)"ERR_SELVA EACCES Permission denied",
    [-SELVA_ENOBUFS]                    = (const char *)"ERR_SELVA ENOBUFS No buffer or resource space available",
    [-SELVA_EINPROGRESS]                = (const char *)"ERR_SELVA EINPROGRESS Operation in progress",
    [-SELVA_EIO]                        = (const char *)"ERR_SELVA EIO Input/output error",
    [-SELVA_ETIMEDOUT]                  = (const char *)"ERR_SELVA ETIMEDOUT Timed out",
    [-SELVA_PROTO_EAGAIN]               = (const char *)"ERR_PROTO EAGAIN Resource temporarily unavailable",
    [-SELVA_PROTO_EALREADY]             = (const char *)"ERR_PROTO EALREADY Operation already in progress",
    [-SELVA_PROTO_ENOTSUP]              = (const char *)"ERR_PROTO ENOTSUP Operation not supported",
    [-SELVA_PROTO_EINVAL]               = (const char *)"ERR_PROTO EINVAL Invalid argument/input value",
    [-SELVA_PROTO_EINTYPE]              = (const char *)"ERR_PROTO EINTYPE Invalid type",
    [-SELVA_PROTO_ENOMEM]               = (const char *)"ERR_PROTO ENOMEM Out of memory",
    [-SELVA_PROTO_ENOENT]               = (const char *)"ERR_PROTO ENOENT Node or entity not found",
    [-SELVA_PROTO_EEXIST]               = (const char *)"ERR_PROTO EEXIST Entity already exist",
    [-SELVA_PROTO_ENOBUFS]              = (const char *)"ERR_PROTO ENOBUFS No buffer or resource space available",
    [-SELVA_PROTO_EBADMSG]              = (const char *)"ERR_PROTO EBADMSG Bad message",
    [-SELVA_PROTO_EBADF]                = (const char *)"ERR_PROTO EBADF Not a valid open file descriptor",
    [-SELVA_PROTO_ECONNRESET]           = (const char *)"ERR_PROTO ECONNRESET Connection reset by peer",
    [-SELVA_PROTO_ENOTCONN]             = (const char *)"ERR_PROTO ENOTCONN The socket is not connected",
    [-SELVA_PROTO_EPIPE]                = (const char *)"ERR_PROTO EPIPE The local end has been shutdown",
    [-SELVA_INVALID_ERROR]              = (const char *)"ERR_SELVA Invalid error code"
};

const char *selva_strerror(int err) {
    int i = -err;

    i = (i >= 0 && i < (-SELVA_INVALID_ERROR + 1)) ? i : -SELVA_EGENERAL;

    return err2str[i];
}
