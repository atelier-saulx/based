/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include "event_loop.h"
#include "evl_signal.h"
#include "util/sigstr.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_reaper.h"

static reaper_hook_t hooks[2];

void selva_reaper_register_hook(reaper_hook_t hook, int prio)
{
    assert((ssize_t)prio < (ssize_t)num_elem(hooks));
    assert(!hooks[prio]);
    hooks[prio] = hook;
}

/**
 * Translate child exit status into a selva_error and log messages.
 */
static int handle_child_status(pid_t pid, int status)
{
    if (WIFEXITED(status)) {
        int code = WEXITSTATUS(status);

        if (code != 0) {
            SELVA_LOG(SELVA_LOGL_ERR,
                      "child %d terminated with exit code: %d",
                      (int)pid, code);

            return SELVA_EGENERAL;
        }
    } else if (WIFSIGNALED(status)) {
        int termsig = WTERMSIG(status);

        SELVA_LOG(SELVA_LOGL_ERR,
                  "child %d killed by signal SIG%s (%s)%s",
                  (int)pid, sigstr_abbrev(termsig), sigstr_descr(termsig),
                  (WCOREDUMP(status)) ? " (core dumped)" : NULL);

        return SELVA_EGENERAL;
    } else {
        SELVA_LOG(SELVA_LOGL_ERR, "child %d terminated abnormally", pid);

        return SELVA_EGENERAL;
    }

    return 0;
}

static void selva_reaper_reap(void)
{
    pid_t pid;
    int status;

    while ((pid = waitpid(0, &status, WNOHANG)) > 0) {
        int err = handle_child_status(pid, status);

        for (size_t i = 0; i < num_elem(hooks); i++) {
            if (hooks[i] && hooks[i](pid, status, err)) {
                break;
            }
        }
    }
}

static void handle_signal(struct event *ev, void *arg __unused)
{
    struct evl_siginfo esig;
    int err, signo;

    err = evl_read_sigfd(&esig, ev->fd);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to read sigfd. fd: %d err: \"%s\"",
                  ev->fd,
                  selva_strerror(err));
        return;
    }

    signo = esig.esi_signo;

    if (unlikely(signo != SIGCHLD)) {
        SELVA_LOG(SELVA_LOGL_WARN, "Received unexpected signal (%d): %s", signo, strsignal(esig.esi_signo));
        return;
    }

    /*
     * Note that si_pid is not reliable on Darwin/BSD and can be 0 and on Linux
     * si_pid might be set to one pid but there are actually more than one
     * zombies. Hence, we have a loop here.
     */

    selva_reaper_reap();
}

/**
 * Setup catching SIGCHLD with the event_loop.
 * We want to catch SIGCHLD here as we use a child process to make hierarchy
 * dumps asynchronously. Hopefully no other module will need the same signal.
 */
void setup_sigchld(void)
{
    sigset_t mask;
    int sfd;

    sigemptyset(&mask);
    sigaddset(&mask, SIGCHLD);

    sfd = evl_create_sigfd(&mask);
    if (sfd >= 0) {
        evl_wait_fd(sfd, handle_signal, NULL, NULL, NULL);
    }
}
