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
 * Resource temporarily unavailable.
 */
#define SELVA_PROTO_EAGAIN              (-15)
/**
 * Operation already in progress.
 */
#define SELVA_PROTO_EALREADY            (-16)
/**
 * Operation not supported.
 */
#define SELVA_PROTO_ENOTSUP             (-17)
/**
 * Invalid argument/input value.
 */
#define SELVA_PROTO_EINVAL              (-18)
/**
 * Invalid type.
 */
#define SELVA_PROTO_EINTYPE             (-19)
/**
 * Out of memory.
 */
#define SELVA_PROTO_ENOMEM              (-20)
/**
 * Node or entity not found.
 */
#define SELVA_PROTO_ENOENT              (-21)
/**
 * Entity already exist.
 */
#define SELVA_PROTO_EEXIST              (-22)
/**
 * No buffer or resource space available.
 */
#define SELVA_PROTO_ENOBUFS             (-23)
/**
 * Bad message.
 */
#define SELVA_PROTO_EBADMSG             (-24)
/**
 * Not a valid open file descriptor.
 */
#define SELVA_PROTO_EBADF               (-25)
/**
 * Connection reset by peer.
 */
#define SELVA_PROTO_ECONNRESET          (-26)
/**
 * The socket is not connected.
 */
#define SELVA_PROTO_ENOTCONN            (-27)
/**
 * The local end has been shutdown.
 */
#define SELVA_PROTO_EPIPE               (-28)

/**
 * General error.
 */
#define SELVA_HIERARCHY_EGENERAL        (-29)
/**
 * Operation not supported.
 */
#define SELVA_HIERARCHY_ENOTSUP         (-30)
/**
 * Invalid argument/input value.
 */
#define SELVA_HIERARCHY_EINVAL          (-31)
/**
 * Out of memory.
 */
#define SELVA_HIERARCHY_ENOMEM          (-32)
/**
 * Node or entity not found.
 */
#define SELVA_HIERARCHY_ENOENT          (-33)
/**
 * Node or entity already exist.
 */
#define SELVA_HIERARCHY_EEXIST          (-34)
/**
 * Maximum number of recursive traversal calls reached.
 */
#define SELVA_HIERARCHY_ETRMAX          (-35)

/**
 * General error.
 */
#define SELVA_SUBSCRIPTIONS_EGENERAL    (-36)
/**
 * Invalid argument/input value.
 */
#define SELVA_SUBSCRIPTIONS_EINVAL      (-37)
/**
 * Out of memory.
 */
#define SELVA_SUBSCRIPTIONS_ENOMEM      (-38)
/**
 * Node or entity not found.
 */
#define SELVA_SUBSCRIPTIONS_ENOENT      (-39)
/**
 * Node or entity already exist.
 */
#define SELVA_SUBSCRIPTIONS_EEXIST      (-40)

/**
 * RPN compilation error.
 */
#define SELVA_RPN_ECOMP                 (-41)

/**
 * Selva object has reached the maximum size.
 */
#define SELVA_OBJECT_EOBIG              (-42)
/**
 * Selva object precondition mismatch or failed.
 */
#define SELVA_OBJECT_EMISMATCH          (-43)
/* This must be the last error */
#define SELVA_INVALID_ERROR             (-44)

/**
 * Selva error code to string.
 * Implemented in libutil.
 */
const char *selva_strerror(int err);
