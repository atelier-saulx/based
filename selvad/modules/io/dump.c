/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <assert.h>
#if defined(__linux__)
#include <sched.h>
#endif
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include "sha3iuf/sha3.h"
#include "util/ctime.h"
#include "util/finalizer.h"
#include "util/selva_cpu.h"
#include "util/selva_rusage.h"
#include "util/selva_string.h"
#include "util/timestamp.h"
#include "event_loop.h"
#include "selva_db_types.h"
#include "selva_error.h"
#include "selva_io.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_reaper.h"
#include "selva_server.h"
#include "sdb_name.h"
#include "replication/replication.h"
#include "dump.h"

static bool selva_db_is_dirty;
static enum selva_io_dump_state selva_db_dump_state;
static pid_t save_pid;
static uint64_t save_sdb_eid;
static struct selva_server_response_out *save_stream_resp;
static struct selva_io_serializer serializers[NR_SELVA_IO_ORD];

/**
 * Save db at exit.
 */
bool save_at_exit = true;

/**
 * [sec] Load the default SDB on startup and save a dump on interval.
 * 0 = disabled.
 */
int auto_save_interval = 0;

void selva_io_set_dirty(void)
{
    selva_db_is_dirty = true;
}

void selva_io_register_serializer(enum selva_io_load_order ord, const struct selva_io_serializer *serializer)
{
    assert(ord >= 0 && ord < NR_SELVA_IO_ORD);
    serializers[ord] = *serializer;
}

enum selva_io_dump_state selva_io_get_dump_state(void)
{
    return selva_db_dump_state;
}

static int gen_default_sdb_name(char filename[static SDB_NAME_MIN_BUF_SIZE])
{
    return sdb_name(filename, SDB_NAME_MIN_BUF_SIZE, NULL, (uint64_t)ts_monorealtime_now());
}

static void handle_last_good_sync(void)
{
    uint8_t hash[SELVA_IO_HASH_SIZE];
    struct selva_string *filename;
    const char *filename_str;

    if (selva_io_last_good_info(hash, &filename)) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to read the last good file (sync)");
        return;
    }

    filename_str = selva_string_to_str(filename, NULL);
    SELVA_LOG(SELVA_LOGL_INFO, "Found last good (sync): \"%s\"", filename_str);
    selva_replication_new_sdb(filename_str, hash);

    selva_string_free(filename);
}

static int handle_last_good_async(void)
{
    uint8_t hash[SELVA_IO_HASH_SIZE];
    struct selva_string *filename;

    if (selva_io_last_good_info(hash, &filename)) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to read the last good file (async)");
        return 0;
    }

    SELVA_LOG(SELVA_LOGL_INFO, "Found last good (async): \"%s\"", selva_string_to_str(filename, NULL));
    selva_replication_complete_sdb(save_sdb_eid, hash);

    selva_string_free(filename);

    return 1;
}

/**
 * A SIGCHLD should mean that either a new dump is ready or the child crashed
 * while dumping.
 */
static int handle_child_status(pid_t pid, int status __unused, int selva_err)
{
    int saved;

    if (pid != save_pid) {
        return 0;
    }

    if (!selva_err) {
        /*
         * last_good isn't necessarily the same file the child saved
         * but it's the last good so we report it. Could this result
         * an incomplete SDB to be left? Yes.
         */
        saved = handle_last_good_async();
        selva_db_is_dirty = false;
    }

    selva_db_dump_state = SELVA_DB_DUMP_NONE;
    save_pid = 0;
    save_sdb_eid = 0;

    /*
     * E.g. auto-save doesn't have a response stream.
     */
    if (save_stream_resp) {
        if (selva_err) {
            selva_send_errorf(save_stream_resp, selva_err, "Save failed");
        } else {
            selva_send_ll(save_stream_resp, saved);
        }
        selva_send_end(save_stream_resp);
        save_stream_resp = NULL;
    }

    return 1;
}

/**
 * Print ready message after load/save.
 */
static void print_ready(const char * restrict msg, struct timespec * restrict ts_start, struct timespec * restrict ts_end)
{
    struct timespec ts_diff;
    double t;
    const char *unit;

    timespec_sub(&ts_diff, ts_end, ts_start);
    t = timespec2ms(&ts_diff);

    if (t < 1e3) {
        unit = "ms";
    } else if (t < 60e3) {
        t /= 1e3;
        unit = "s";
    } else if (t < 3.6e6) {
        t /= 60e3;
        unit = "min";
    } else {
        t /= 3.6e6;
        unit = "h";
    }

    if (selva_db_dump_state == SELVA_DB_DUMP_IS_CHILD) {
        struct selva_rusage rusage;

        selva_getrusage(SELVA_RUSAGE_SELF, &rusage);
        SELVA_LOG(SELVA_LOGL_INFO, "%s ready in %.2f %s, maxrss: %zu bytes", msg, t, unit, (size_t)rusage.ru_maxrss);
    } else {
        SELVA_LOG(SELVA_LOGL_INFO, "%s ready in %.2f %s", msg, t, unit);
    }
}

/**
 * Load a hierarchy dump from io.
 */
static int dump_load(struct selva_io *io)
{
    struct timespec ts_start, ts_end;
    int err = 0;

    ts_monotime(&ts_start);

    for (int i = 0; i < NR_SELVA_IO_ORD; i++) {
        serializers[i].deserialize(io);
    }

    selva_io_end(io);
    handle_last_good_sync(); /* RFE This is a bit heavy and we could just extract the info from `io`. */

    ts_monotime(&ts_end);
    print_ready(__func__, &ts_start, &ts_end);

    return err;
}

static void set_dump_affinity(void)
{
    cpu_set_t cur_set;
    cpu_set_t new_set;

    selva_cpu_get_main_affinity(&cur_set);
    CPU_FILL(&new_set);
    CPU_XOR(&new_set, &new_set, &cur_set);
    selva_cpu_set_main_affinity(&new_set);
}

static void deprio_myself(void)
{
    int err;

    /*
     * Lower the CPU priority (bigger number) to avoid hogging the resources
     * from the main process while dumping. This shouldn't actually reduce
     * the available CPU time, as long as we are assigned on our own
     * core/CPU, which might not be 100% if replication is enabled.
     */
    err = selva_cpu_set_sched_batch();
    if (err) {
        /* Failed to set sched, the next best thing is to just use nice(). */
        const int nice_incr = 10;
        int res;

        res = nice(nice_incr);
        if (res == -1) {
            SELVA_LOG(SELVA_LOGL_WARN, "Failed to deprioritize the dump process");
        }
    }
}

/**
 * Save a hierarchy dump asynchronously in a child process.
 */
static int dump_save_async(const char *filename)
{
    struct timespec ts_start, ts_end;
    pid_t pid;
    int err;

    if (save_pid) {
        /* Already saving */
        return SELVA_EINPROGRESS;
    }

    ts_monotime(&ts_start);

    save_sdb_eid = selva_replication_incomplete_sdb(filename);

    pid = fork();
    if (pid == 0) {
        const enum selva_io_flags flags = SELVA_IO_FLAGS_WRITE;
        struct selva_io io;

        selva_db_dump_state = SELVA_DB_DUMP_IS_CHILD;
        set_dump_affinity();
        deprio_myself();

        err = selva_io_init(&io, filename, flags);
        if (err) {
            return err;
        }

        for (int i = 0; i < NR_SELVA_IO_ORD; i++) {
            serializers[i].serialize(&io);
        }

        selva_io_end(&io);

        ts_monotime(&ts_end);
        print_ready(__func__, &ts_start, &ts_end);

        exit(EXIT_SUCCESS);
    } else if (pid < 0) {
        save_sdb_eid = 0;
        return SELVA_EGENERAL;
    }

    selva_db_dump_state = SELVA_DB_DUMP_ACTIVE_CHILD;
    save_pid = pid;

    return 0;
}

/**
 * Save a hierarchy dump synchronously.
 */
static int dump_save_sync(const char *filename)
{
    struct timespec ts_start, ts_end;
    const enum selva_io_flags flags = SELVA_IO_FLAGS_WRITE;
    struct selva_io io;
    int err;

    if (save_pid) {
        /* Already saving */
        return SELVA_EINPROGRESS;
    }

    ts_monotime(&ts_start);

    err = selva_io_init(&io, filename, flags);
    if (err) {
        return err;
    }

    for (int i = 0; i < NR_SELVA_IO_ORD; i++) {
        serializers[i].serialize(&io);
    }

    selva_io_end(&io);

    handle_last_good_sync();
    selva_db_is_dirty = false;

    ts_monotime(&ts_end);
    print_ready(__func__, &ts_start, &ts_end);

    return 0;
}

/**
 * Trigger async dump periodically.
 * This function shouldn't be called directly but by a selva timer. The
 * initializer for periodic dumps is dump_auto_sdb().
 */
static void auto_save(struct event *, void *arg)
{
    struct timespec *ts = (struct timespec *)arg;
    int tim, err;

    if (selva_server_is_query_fork()) {
        /* Never auto save in a query fork. */
        return;
    }

    tim = evl_set_timeout(ts, auto_save, ts);
    if (tim < 0) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to schedule an autosave");
        exit(EXIT_FAILURE);
    }

    if (selva_db_is_dirty) {
        char filename[SDB_NAME_MIN_BUF_SIZE];

        gen_default_sdb_name(filename);
        err = dump_save_async(filename);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to autosave: %s", selva_strerror(err));
        }
    }
}

static int dump_load_default_sdb(void)
{
    struct selva_io io;
    int err;

    err = selva_io_open_last_good(&io);
    if (err == SELVA_ENOENT) {
        return 0;
    } else if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to open the last good SDB");
        return err;
    }

    err = dump_load(&io);
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to load the last good SDB: %s",
                  selva_strerror(err));
        return err;
    }

    return 0;
}

static int dump_auto_sdb(int interval_s)
{
    static struct timespec ts;
    int tim;

    assert(interval_s > 0);
    assert(ts.tv_sec == 0); /* This function should be only called once. */

    ts.tv_sec = interval_s;

    tim = evl_set_timeout(&ts, auto_save, &ts);
    if (tim < 0) {
        return tim;
    }

    return 0;
}

static void load_db_cmd(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    __auto_finalizer struct finalizer fin;
    struct selva_string *filename;
    int argc, err;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%p", &filename);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    const enum selva_io_flags flags = SELVA_IO_FLAGS_READ;
    struct selva_io io;

    err = selva_io_init(&io, selva_string_to_str(filename, NULL), flags);
    if (err) {
        selva_send_errorf(resp, SELVA_EGENERAL, "Failed to open the dump file");
        return;
    }

    err = dump_load(&io);
    if (err) {
        if (err == SELVA_EGENERAL) {
            selva_send_errorf(resp, SELVA_EGENERAL, "Failed to load main_hierarchy");
        } else {
            selva_send_errorf(resp, err, "Failed to open the db file");
        }
        return;
    }

    selva_send_ll(resp, 1);
}

static void save_db_cmd(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    __auto_finalizer struct finalizer fin;
    struct selva_string *filename;
    const char *filename_str;
    char default_filename[SDB_NAME_MIN_BUF_SIZE];
    int argc, err;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%p", &filename);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc == 0) {
        gen_default_sdb_name(default_filename);
        filename_str = default_filename;
    } else if (argc == 1) {
        if (!selva_string_endswith(filename, ".sdb")) {
            selva_send_errorf(resp, SELVA_EINVAL, "Invalid filename extension");
            return;
        }

        if (!strcmp(selva_string_to_str(filename, NULL), "dump.sdb")) {
            selva_send_errorf(resp, SELVA_EINVAL, "dump.sdb is a reserved filename");
            return;
        }

        err = selva_start_stream(resp, &save_stream_resp);
        if (err && err != SELVA_PROTO_ENOTCONN) {
            selva_send_errorf(resp, err, "Failed to create a stream");
            return;
        }

        filename_str = selva_string_to_str(filename, NULL);
    } else {
        selva_send_error_arity(resp);
        return;
    }

    err = dump_save_async(filename_str);
    if (err) {
        if (save_stream_resp) {
            selva_cancel_stream(resp, save_stream_resp);
            save_stream_resp = NULL;
        }
        selva_send_errorf(resp, err, "Save failed");
        return;
    }

    /*
     * Response to the command will be sent once the dump is ready.
     */
}

static void flush_db_cmd(struct selva_server_response_out *resp, const void *buf __unused, size_t len)
{
    if (len) {
        selva_send_error_arity(resp);
        return;
    }

    for (int i = 0; i < NR_SELVA_IO_ORD; i++) {
        serializers[i].flush();
    }

    selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
    selva_send_ll(resp, 1);
}

static void load_on_startup(struct event *, void *)
{
    int err = dump_load_default_sdb();
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to load the default dump: %s",
                  selva_strerror(err));
        exit(EXIT_FAILURE);
    }
}

static bool is_every_serializer_ready(void)
{
    bool ready = true;

    for (int i = 0; i < NR_SELVA_IO_ORD; i++) {
        ready = ready && serializers[i].is_ready();
    }

    return ready;
}

__used static void dump_on_exit(int code, void *)
{
    char filename[SDB_NAME_MIN_BUF_SIZE];
    int err;

    if (code != 0 ||
        selva_db_dump_state == SELVA_DB_DUMP_IS_CHILD ||
        !selva_db_is_dirty ||
        selva_server_is_query_fork() ||
        !is_every_serializer_ready() ||
        replication_mode == SELVA_REPLICATION_MODE_REPLICA) {
        /* A dump shall not be made in several cases. */
        return;
    }

    SELVA_LOG(SELVA_LOGL_INFO, "Dumping the hierarchy before exit...");

    gen_default_sdb_name(filename);
    err = dump_save_sync(filename);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Dump on exit failed: %s", selva_strerror(err));
    }
}

void dump_init(void)
{
    selva_mk_command(CMD_ID_LOAD, SELVA_CMD_MODE_MUTATE, "load", load_db_cmd);
    selva_mk_command(CMD_ID_SAVE, SELVA_CMD_MODE_PURE, "save", save_db_cmd);
    selva_mk_command(CMD_ID_FLUSH, SELVA_CMD_MODE_MUTATE, "flush", flush_db_cmd);

    /*
     * We can only load the dump once all modules expected to touch the dumps are
     * loaded.
     */
    if (evl_set_timeout(&(struct timespec){ 0 }, load_on_startup, NULL) < 0) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to setup a timer");
        exit(EXIT_FAILURE);
    }

    selva_reaper_register_hook(handle_child_status, 0);

    if (save_at_exit) {
#ifdef __GLIBC__
        if (on_exit(dump_on_exit, NULL)) {
            SELVA_LOG(SELVA_LOGL_CRIT, "Failed to register an exit function");
            exit(EXIT_FAILURE);
        }
#else
        SELVA_LOG(SELVA_LOGL_WARN, "Not registering an exit function (GLIBC-only feat)");
#endif
    }

    if (auto_save_interval > 0 &&
        dump_auto_sdb(auto_save_interval)) {
        exit(EXIT_FAILURE);
    }
}
