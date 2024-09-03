const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const db = @import("./db.zig");
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

fn startInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(3, napi_env, info);
    const path = try napi.get([]u8, napi_env, args[0]);
    const readOnly = try napi.get(bool, napi_env, args[1]);
    const sdb_filename = try getOptPath(napi_env, args[2]);

    try errors.mdb(c.mdb_env_create(&db.ctx.env));
    errdefer c.mdb_env_close(db.ctx.env);
    try errors.mdb(c.mdb_env_set_mapsize(db.ctx.env, 1000 * 1000 * 1000 * 100));
    try errors.mdb(c.mdb_env_set_maxdbs(db.ctx.env, 20_000_000));
    try errors.mdb(c.mdb_env_set_maxreaders(db.ctx.env, 126));

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

    errors.mdb(c.mdb_env_open(db.ctx.env, path.ptr, flags, 0o664)) catch |err| {
        std.log.err("Open lmdb env {any}", .{err});
    };

    if (sdb_filename != null) {
        try errors.selva(selva.selva_dump_load(sdb_filename.?.ptr, &db.ctx.selva));
    } else {
        db.ctx.selva = selva.selva_db_create();
    }

    // SORT INDEXES
    try initSort();

    // NEED TYPES + LAST ID + ENTRIES
    // db.selva.types EACH

    std.debug.print("have to get all TYPES + LAST IDS + ENTRIES \n", .{});

    return null;
}

// make extra method
// LOCK

fn stopInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {

    // selva_dump_save_async
    // done :/
    // TODO: fix

    // if last is magic string
    // check every second

    selva.selva_db_destroy(db.ctx.selva);

    db.ctx.selva = null;

    var sortIt = db.ctx.sortIndexes.iterator();
    while (sortIt.next()) |item| {
        const sortIndex = item.value_ptr.*;
        if (db.ctx.sortIndexes.remove(item.key_ptr.*)) {
            c.mdb_cursor_close(sortIndex.cursor);
            c.mdb_dbi_close(db.ctx.env, sortIndex.dbi);
        }
    }

    var mainSortIt = db.ctx.mainSortIndexes.iterator();
    while (mainSortIt.next()) |item| {
        const mainSort = item.value_ptr.*;
        mainSort.deinit();
        _ = db.ctx.mainSortIndexes.remove(item.key_ptr.*);
    }

    db.ctx.mainSortIndexes.clearRetainingCapacity();

    if (db.ctx.readTxnCreated) {
        c.mdb_txn_abort(db.ctx.readTxn);
    }

    c.mdb_env_close(db.ctx.env);

    db.ctx.readTxnCreated = false;

    return null;
}
