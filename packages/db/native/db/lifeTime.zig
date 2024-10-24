const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const db = @import("./db.zig");
const dump = @import("./dump.zig");
const initSort = @import("./initSort.zig").initSort;
const selva = @import("../selva.zig");

pub fn start(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return startInternal(napi_env, info) catch return null;
}

pub fn stop(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return stopInternal(napi_env, info) catch return null;
}

fn getOptPath(
    env: c.napi_env,
    value: c.napi_value,
) !?[]u8 {
    const t = try napi.getType(env, value);
    return if (!(t == c.napi_null or t == c.napi_undefined)) try napi.get([]u8, env, value) else null;
}

// have to pass the pointer to js
// NAPI_VALUE here has to be the pointer

fn startInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(3, napi_env, info);
    const path = try napi.get([]u8, napi_env, args[0]);
    const readOnly = try napi.get(bool, napi_env, args[1]);
    const id = try napi.get(u32, napi_env, args[2]);

    const ctx = try db.createDbCtx(id);

    try errors.mdb(c.mdb_env_create(&ctx.env));
    errdefer c.mdb_env_close(ctx.env);
    try errors.mdb(c.mdb_env_set_mapsize(ctx.env, 1000 * 1000 * 1000 * 100));
    try errors.mdb(c.mdb_env_set_maxdbs(ctx.env, 20_000_000));
    try errors.mdb(c.mdb_env_set_maxreaders(ctx.env, 126));

    var flags: c_uint = 0;

    if (readOnly) {
        flags |= c.MDB_RDONLY;
    }

    // only 1 writer per db
    flags |= c.MDB_NOLOCK;

    // no sync
    flags |= c.MDB_NOSYNC;

    // no meta sync
    flags |= c.MDB_NOMETASYNC;

    // writable mmap
    flags |= c.MDB_WRITEMAP;

    errors.mdb(c.mdb_env_open(ctx.env, path.ptr, flags, 0o664)) catch |err| {
        std.log.err("Open lmdb env {any}", .{err});
    };

    ctx.selva = selva.selva_db_create();

    try initSort(ctx);

    // TODO: MAKE A UTIL
    var externalNapi: c.napi_value = undefined;
    _ = c.napi_create_external(napi_env, ctx, null, null, &externalNapi);
    return externalNapi;
}

fn stopInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*db.DbCtx, napi_env, args[0]);

    // selva.selva_db_destroy(ctx.selva);

    // if last is magic string
    // check every second

    if (ctx.selva != null) {
        selva.selva_db_destroy(ctx.selva);
    }

    ctx.selva = null;

    var sortIt = ctx.sortIndexes.iterator();
    while (sortIt.next()) |item| {
        const sortIndex = item.value_ptr.*;
        if (ctx.sortIndexes.remove(item.key_ptr.*)) {
            c.mdb_cursor_close(sortIndex.cursor);
            c.mdb_dbi_close(ctx.env, sortIndex.dbi);
        }
    }

    var mainSortIt = ctx.mainSortIndexes.iterator();
    while (mainSortIt.next()) |item| {
        const mainSort = item.value_ptr.*;
        mainSort.deinit();
        _ = ctx.mainSortIndexes.remove(item.key_ptr.*);
    }

    ctx.mainSortIndexes.clearRetainingCapacity();

    if (ctx.readTxnCreated) {
        c.mdb_txn_abort(ctx.readTxn);
    }

    c.mdb_env_close(ctx.env);

    ctx.readTxnCreated = false;

    // delete instance
    _ = db.dbHashmap.remove(ctx.id);
    ctx.arena.deinit();

    return null;
}
