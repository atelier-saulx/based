const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");
const db = @import("./db.zig");
const stat = @import("./stat.zig");
const selva = @import("../selva.zig");

pub fn start(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return startInternal(napi_env, info) catch return null;
}

pub fn stop(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return stopInternal(napi_env, info) catch return null;
}

fn startInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {

    // add extra args
    // READONLY
    // read only needs to be set on global var
    // if readonly sort indexes need to be created from the write worker
    // make a seperate method to create a or get a sort index from js
    // inteprocess communication with queries etc - maybe add query on db and use workers behind it automaticluy

    const args = try napi.getArgs(2, napi_env, info);
    const path = try napi.getStringFixedLength("createEnv", 256, napi_env, args[0]);

    const readOnly = try napi.getBool("readOnly", napi_env, args[1]);

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

    errors.mdb(c.mdb_env_open(db.ctx.env, &path, flags, 0o664)) catch |err| {
        std.log.err("Open lmdb env {any}", .{err});
    };

    // plz
    db.ctx.selva = selva.selva_db_create();

    return stat.statInternal(napi_env, true);
}

fn stopInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    selva.selva_db_destroy(db.ctx.selva);

    db.ctx.selva = null;

    var it = db.ctx.readShards.iterator();
    while (it.next()) |item| {
        const readShard = item.value_ptr.*;
        if (db.ctx.readShards.remove(item.key_ptr.*)) {
            c.mdb_cursor_close(readShard.cursor);
            c.mdb_dbi_close(db.ctx.env, readShard.dbi);
        }
    }

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
