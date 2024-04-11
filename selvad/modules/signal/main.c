/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <dlfcn.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "selva_log.h"
#include "selva_error.h"
#include "event_loop.h"
#include "evl_signal.h"
#include "promise.h"
#include "module.h"
#include "trace.h"
#include "selva_reaper.h"

static bool handle_signal(struct event *ev, void *arg __unused)
{
    struct evl_siginfo esig;
    int signo;

    if (evl_read_sigfd(&esig, ev->fd)) {
        fprintf(stderr, "Failed to read sigfd\n");
        return false;
    }

    signo = esig.esi_signo;
    fprintf(stderr, "Received signal (%d): %s\n", signo, strsignal(esig.esi_signo));

    switch (signo) {
    case SIGINT:
    case SIGTERM:
        exit(EXIT_SUCCESS);
    }

    return false;
}

/**
 * Signals that should terminate the process.
 * These are also often but not always synchronus signals that can't be used with
 * evl_create_sigfd().
 */
#define TERM_SIGNALS(apply) \
    apply(SIGABRT) \
    apply(SIGKILL) \
    apply(SIGSEGV) \
    apply(SIGBUS) \
    apply(SIGFPE) \
    apply(SIGILL) \
    apply(SIGSTOP) \
    apply(SIGSYS)

static void setup_async_signals(void)
{
	sigset_t mask;
	int sfd;

    /*
     * We try to catch everything async.
     */
	sigemptyset(&mask);
    sigfillset(&mask);
#define DEL_SIGNAL(sig) \
    sigdelset(&mask, sig);
    TERM_SIGNALS(DEL_SIGNAL);
    sigdelset(&mask, SIGPIPE);
    sigdelset(&mask, SIGCHLD); /* We want to catch this where we use fork(). */
    sigdelset(&mask, SIGWINCH);
#undef DEL_SIGNAL

#ifdef __linux__
    /*
     * Don't catch real-time signals to make VTune work.
     */
    for (int sig_rt = SIGRTMIN; sig_rt < SIGRTMAX; sig_rt++) {
        sigdelset(&mask, sig_rt);
    }
#endif

    sfd = evl_create_sigfd(&mask);
    if (sfd >= 0) {
        evl_wait_fd(sfd, handle_signal, NULL, NULL, NULL);
    } else {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to create a sigfd: %s", selva_strerror(sfd));
    }
}

IMPORT() {
    evl_import_event_loop();
    evl_import_signal();
    evl_import_main(selva_log);
}

__constructor static void init(void)
{
    /*
     * SIGPIPE can be sync or async depending on the system.
     * Either way, we just want to ignore it.
     */
    sigaction(SIGPIPE, &(struct sigaction){ .sa_handler = SIG_IGN }, NULL);

#define SETUP_TERM(sig) \
    setup_term_signal(sig);
    TERM_SIGNALS(SETUP_TERM);
#undef SETUP_TERM

    setup_async_signals();
    setup_sigchld();
}
