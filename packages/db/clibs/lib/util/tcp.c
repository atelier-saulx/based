/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#if __linux__
#include <arpa/inet.h> /* Linux defines IPPROTO_TCP in here */
#include <sys/sendfile.h>
#endif
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <sys/socket.h>
#include <sys/types.h>
#if defined(__APPLE__) /* sendfile on MacOs */
#include <sys/types.h>
#endif
#include <errno.h>
#include <string.h>
#include <sys/uio.h>
#include <time.h>
#include <unistd.h>
#include "selva_error.h"
#include "util/tcp.h"

#define MAX_RETRIES 3

static const int use_tcp_nodelay = 1;

void tcp_set_nodelay(int fd)
{
    if (use_tcp_nodelay) {
        (void)setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &(int){1}, sizeof(int));
    }
}

void tcp_unset_nodelay(int fd)
{
    if (use_tcp_nodelay) {
        (void)setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &(int){0}, sizeof(int));
    }
}

void tcp_set_keepalive(int fd, int time, int intvl, int probes)
{
#if __linux__
    (void)setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &(int){1}, sizeof(int));
    (void)setsockopt(fd, SOL_TCP, TCP_KEEPIDLE, &time, sizeof(time));
    (void)setsockopt(fd, SOL_TCP, TCP_KEEPINTVL, &intvl, sizeof(intvl));
    (void)setsockopt(fd, SOL_TCP, TCP_KEEPCNT, &probes, sizeof(probes));
#else
    (void)fd;
    (void)time;
    (void)intvl;
    (void)probes;
#endif
}

void tcp_cork(int fd)
{
#if __linux__
    (void)setsockopt(fd, IPPROTO_TCP, TCP_CORK, &(int){1}, sizeof(int));
#else
    tcp_unset_nodelay(fd);
#endif
}

void tcp_uncork(int fd)
{
#if __linux__
    (void)setsockopt(fd, IPPROTO_TCP, TCP_CORK, &(int){0}, sizeof(int));
#else
    const char *buf = "";

    tcp_set_nodelay(fd);
    send(fd, buf, 0, 0);
#endif
}

static int errno2serr(int errno_bak, int *retry_count)
{
    switch (errno_bak) {
    case EAGAIN:
#if EWOULDBLOCK != EAGAIN
    case EWOULDBLOCK:
#endif
        return SELVA_PROTO_EAGAIN;
    case ENOBUFS:
        if ((*retry_count)++ > MAX_RETRIES) {
            return SELVA_PROTO_ENOBUFS;
        } else {
            /*
             * The safest thing to do is a blocking sleep so this
             * thread/process will give the kernel some time to
             * flush its buffers.
             */
            const struct timespec tim = {
                .tv_sec = 0,
                .tv_nsec = 500, /* *sleeve-shaking* */
            };

            nanosleep(&tim, NULL);
        }

        return 0;
    case EINTR:
        return 0;
    case EBADF:
        return SELVA_PROTO_EBADF;
    case ENOMEM:
        return SELVA_PROTO_ENOMEM;
    case ECONNRESET:
        return SELVA_PROTO_ECONNRESET;
    case ENOTCONN:
        return SELVA_PROTO_ENOTCONN;
    case ENOTSUP:
#if ENOTSUP != EOPNOTSUPP
    case EOPNOTSUPP:
#endif
        return SELVA_PROTO_ENOTSUP;
    default:
        return SELVA_PROTO_EINVAL;
    }
}

ssize_t tcp_recv(int fd, void *buf, size_t n, int flags)
{
    int retries = 0;
	ssize_t i = 0;

	while (i < (ssize_t)n) {
		ssize_t res;

retry:
		res = recv(fd, (char *)buf + i, n - i, flags);
		if (res <= 0) {
            int err;

            err = errno2serr(errno, &retries);
            if (err == 0) {
                goto retry;
            }
			return i;
		}

		i += res;
	}

	return i;
}

ssize_t tcp_read(int fd, void *buf, size_t n)
{
    int retries = 0;
	ssize_t i = 0;

	while (i < (ssize_t)n) {
		ssize_t res;

retry:
		res = read(fd, (char *)buf + i, n - i);
        if (res == 0) {
            return SELVA_PROTO_ENOTCONN;
        } else if (res < 0) {
            int err;

            err = errno2serr(errno, &retries);
            if (err) {
                return err;
            }
            goto retry;
		}

		i += res;
	}

	return i;
}

ssize_t tcp_write(int fd, void *buf, size_t n)
{
    int retries = 0;
	ssize_t i = 0;

	while (i < (ssize_t)n) {
		ssize_t res;

retry:
		res = write(fd, (char *)buf + i, n - i);
        if (res < 0) {
            int err;

            err = errno2serr(errno, &retries);
            if (err) {
                return err;
            }
            goto retry;
		}

		i += res;
	}

	return i;
}

static size_t tcp_iov_op(int fd, struct iovec *remain_vec, size_t count, ssize_t (*iov_fn)(int filedes, const struct iovec *vector, int count))
{
    int retries = 0;
    struct iovec *remain_p = remain_vec;
    size_t remain_count = count;
    ssize_t tot_bytes = 0;

    while (remain_count > 0) {
        ssize_t bytes;
retry:
        bytes = iov_fn(fd, remain_p, remain_count);
        if (bytes == 0 && iov_fn == readv) {
            return SELVA_PROTO_ENOTCONN;
        } else if (bytes == -1) {
            int err;

            err = errno2serr(errno, &retries);
            if (err == SELVA_PROTO_EAGAIN && tot_bytes > 0) {
                const struct timespec tim = {
                    .tv_sec = 0,
                    .tv_nsec = 500, /* *sleeve-shaking* */
                };

                nanosleep(&tim, NULL);
                goto retry;
            } else if (err) {
                return err;
            }
            goto retry;
        }

        size_t bytes_to_consume = bytes;
        while (bytes_to_consume > 0) {
            if (bytes_to_consume >= remain_p->iov_len) {
                /* consume entire vector element */
                bytes_to_consume -= remain_p->iov_len;
                remain_count--;
                remain_p++;
            } else {
                /* consume partial vector element */
                remain_p->iov_len -= bytes_to_consume;
                remain_p->iov_base = (char *)remain_p->iov_base + bytes_to_consume;
                bytes_to_consume = 0;
            }
        }

        tot_bytes += bytes;
    }

    return tot_bytes;
}

ssize_t tcp_readv(int fd, struct iovec *vec, size_t count)
{
    return tcp_iov_op(fd, vec, count, readv);
}

ssize_t tcp_writev(int fd, struct iovec *vec, size_t count)
{
    return tcp_iov_op(fd, vec, count, writev);
}

off_t tcp_sendfile(int out_fd, int in_fd, off_t *offset, size_t count)
{
    off_t bytes_sent;

#if __APPLE__
    int err;

    bytes_sent = count;
    err = sendfile(in_fd, out_fd, *offset, &bytes_sent, NULL, 0);
    if (err) {
        bytes_sent = -1;
    }
#elif __linux__
    bytes_sent = sendfile(out_fd, in_fd, offset, count);
#else
#error "Not implemented"
#endif
    /*
     * Some of the errors are not SELVA_PROTO but ¯\_(ツ)_/¯
     */
    if (bytes_sent == -1) {
        switch (errno) {
        case EBADF:
            bytes_sent = SELVA_PROTO_EBADF;
            break;
        case EFAULT:
        case EINVAL:
            bytes_sent = SELVA_EINVAL;
            break;
        case EIO:
            bytes_sent = SELVA_EIO;
            break;
        case ENOMEM:
        case EOVERFLOW:
            bytes_sent = SELVA_PROTO_ENOBUFS;
            break;
        case ESPIPE:
            bytes_sent = SELVA_PROTO_EPIPE;
            break;
        default:
            bytes_sent = SELVA_EGENERAL;
            break;
        }
    }

    return bytes_sent;
}
