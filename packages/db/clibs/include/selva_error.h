/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

/*
 * Error codes.
 */

/**
 * General error.
 */
#define SELVA_EGENERAL                  (-1)
/**
 * Operation not supported.
 */
#define SELVA_ENOTSUP                   (-2)
/**
 * Invalid argument/input value.
 */
#define SELVA_EINVAL                    (-3)
/**
 * Result too large.
 */
#define SELVA_ERANGE                    (-4)
/**
 * Invalid type.
 */
#define SELVA_EINTYPE                   (-5)
/**
 * Name too long.
 */
#define SELVA_ENAMETOOLONG              (-6)
/**
 * Out of memory.
 */
#define SELVA_ENOMEM                    (-7)
/**
 * Node or entity not found.
 */
#define SELVA_ENOENT                    (-8)
/**
 * Node or entity already exist.
 */
#define SELVA_EEXIST                    (-9)
/**
 * Permission denied.
 */
#define SELVA_EACCES                    (-10)
/**
 * No buffer or resource space available.
 */
#define SELVA_ENOBUFS                   (-11)
/**
 * Operation already in progress.
 */
#define SELVA_EINPROGRESS               (-12)
/**
 * Input/output error.
 */
#define SELVA_EIO                       (-13)
/**
 * Timed out.
 */
#define SELVA_ETIMEDOUT                 (-14)

/**
 * Maximum number of recursion depth reached.
 */
#define SELVA_ETRMAX                    (-15)

/**
 * Resource temporarily unavailable.
 */
#define SELVA_PROTO_EAGAIN              (-16)
/**
 * Operation already in progress.
 */
#define SELVA_PROTO_EALREADY            (-17)
/**
 * Operation not supported.
 */
#define SELVA_PROTO_ENOTSUP             (-18)
/**
 * Invalid argument/input value.
 */
#define SELVA_PROTO_EINVAL              (-19)
/**
 * Invalid type.
 */
#define SELVA_PROTO_EINTYPE             (-20)
/**
 * Out of memory.
 */
#define SELVA_PROTO_ENOMEM              (-21)
/**
 * Node or entity not found.
 */
#define SELVA_PROTO_ENOENT              (-22)
/**
 * Entity already exist.
 */
#define SELVA_PROTO_EEXIST              (-23)
/**
 * No buffer or resource space available.
 */
#define SELVA_PROTO_ENOBUFS             (-24)
/**
 * Bad message.
 */
#define SELVA_PROTO_EBADMSG             (-25)
/**
 * Not a valid open file descriptor.
 */
#define SELVA_PROTO_EBADF               (-26)
/**
 * Connection reset by peer.
 */
#define SELVA_PROTO_ECONNRESET          (-27)
/**
 * The socket is not connected.
 */
#define SELVA_PROTO_ENOTCONN            (-28)
/**
 * The local end has been shutdown.
 */
#define SELVA_PROTO_EPIPE               (-29)

/* This must be the last error */
#define SELVA_INVALID_ERROR             (-30)

/**
 * Selva error code to string.
 * Implemented in libutil.
 */
const char *selva_strerror(int err);
