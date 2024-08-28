const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const readInt = @import("../utils.zig").readInt;

const selva = @import("../selva.zig");

const mdb = errors.mdb;
const jsThrow = errors.jsThrow;

pub fn statInternal(node_env: c.napi_env, initSortIndex: bool) !c.napi_value {
    var s: c.MDB_stat = undefined;
    var txn: ?*c.MDB_txn = null;
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;

    try mdb(c.mdb_txn_begin(db.ctx.env, null, c.MDB_RDONLY, &txn));
    try mdb(c.mdb_dbi_open(txn, null, 0, &dbi));
    try mdb(c.mdb_cursor_open(txn, dbi, &cursor));

    var dbi2: c.MDB_dbi = 0;

    var done: bool = false;
    var isFirst: bool = true;
    var dbiCnt: usize = 0;
    var entries: usize = 0;
    var size: usize = 0;

    var arr: c.napi_value = undefined;
    _ = c.napi_create_array(node_env, &arr);

    var i: u32 = 0;
    while (!done) {
        var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        if (isFirst) {
            isFirst = false;
            mdb(c.mdb_cursor_get(cursor, &k, &v, c.MDB_FIRST)) catch {
                done = true;
                break;
            };
        } else {
            mdb(c.mdb_cursor_get(cursor, &k, &v, c.MDB_NEXT)) catch {
                done = true;
                break;
            };
        }

        if (k.mv_size == 0) {
            done = true;
            break;
        }

        const dbName = db.data(k);

        mdb(c.mdb_dbi_open(txn, @as([*]u8, @ptrCast(k.mv_data)), c.MDB_INTEGERKEY, &dbi2)) catch |err| {
            std.debug.print("NO DBI {any} DBI {any} \n", .{ err, @as([*]u8, @ptrCast(k.mv_data))[0..k.mv_size] });
            done = true;
            break;
        };
        _ = mdb(c.mdb_stat(txn, dbi2, &s)) catch |err| {
            std.debug.print("STAT ERROR {any} \n", .{err});
        };

        dbiCnt += 1;
        entries += s.ms_entries;
        _ = c.mdb_dbi_close(db.ctx.env, dbi2);

        const dbiSize = s.ms_psize * (s.ms_branch_pages + s.ms_leaf_pages + s.ms_overflow_pages);
        size += dbiSize;

        if (dbName[0] == 254) {
            if (!initSortIndex) {
                continue;
            }

            const field = dbName[3] - 1;
            var name: [7]u8 = .{ dbName[0], dbName[1], dbName[2], dbName[3], 0, 0, 0 };

            const queryId = db.getQueryId();

            if (field == 0) {
                name[4] = dbName[4];
                name[5] = dbName[5];
                name[6] = dbName[6];

                var cursor2: ?*c.MDB_cursor = null;
                try mdb(c.mdb_cursor_open(txn, dbi2, &cursor2));
                mdb(c.mdb_cursor_get(cursor2, &k, &v, c.MDB_FIRST)) catch |err| {
                    std.log.err("Init: cannot create sort cursor {any} \n", .{err});
                };
                const len: u16 = @intCast(db.data(k).len);
                const start = readInt(u16, dbName, 4);

                const newSortIndex = sort.createReadSortIndex(name, queryId, len, start) catch |err| {
                    std.log.err("Init: Cannot create readSortIndex  name: {any} err: {any} \n", .{ name, err });
                    return err;
                };
                try db.ctx.sortIndexes.put(name, newSortIndex);
                continue;
            }

            const newSortIndex = sort.createReadSortIndex(name, 0, 0, 0) catch |err| {
                std.log.err("Init: Cannot create readSortIndex  name: {any} err: {any} \n", .{ name, err });
                return err;
            };
            try db.ctx.sortIndexes.put(name, newSortIndex);

            continue;
        }

        var obj: c.napi_value = undefined;
        _ = c.napi_create_object(node_env, &obj);
        _ = c.napi_set_element(node_env, arr, i, obj);
        i += 1;

        var typeArr: c.napi_value = undefined;
        _ = c.napi_create_array(node_env, &typeArr);
        var char1: c.napi_value = undefined;
        var char2: c.napi_value = undefined;
        _ = c.napi_create_uint32(node_env, dbName[0], &char1);
        _ = c.napi_create_uint32(node_env, dbName[1], &char2);
        _ = c.napi_set_element(node_env, typeArr, 0, char1);
        _ = c.napi_set_element(node_env, typeArr, 1, char2);
        _ = c.napi_set_named_property(node_env, obj, "type", typeArr);

        var field: c.napi_value = undefined;
        _ = c.napi_create_uint32(node_env, dbName[2] - 1, &field);
        _ = c.napi_set_named_property(node_env, obj, "field", field);

        var shards: [2]u8 = .{ 0, 0 };

        if (dbName[3] == 255) {
            shards[0] = 0;
        } else {
            shards[0] = dbName[3];
        }

        shards[1] = dbName[4];

        var shard: c.napi_value = undefined;
        _ = c.napi_create_uint32(node_env, std.mem.readInt(u16, shards[0..2], .little), &shard);
        _ = c.napi_set_named_property(node_env, obj, "shard", shard);

        var e: c.napi_value = undefined;
        _ = c.napi_create_uint32(node_env, @intCast(s.ms_entries), &e);
        _ = c.napi_set_named_property(node_env, obj, "entries", e);

        var cursor2: ?*c.MDB_cursor = null;
        try mdb(c.mdb_cursor_open(txn, dbi2, &cursor2));

        mdb(c.mdb_cursor_get(cursor2, &k, &v, c.MDB_LAST)) catch |err| {
            std.log.err("Init: hello this is wrong {any} \n", .{err});
        };

        if (k.mv_size != 0) {
            var lastId: c.napi_value = undefined;
            _ = c.napi_create_uint32(node_env, std.mem.readInt(u32, db.data(k)[0..4], .little), &lastId);
            _ = c.napi_set_named_property(node_env, obj, "lastId", lastId);
        }
    }

    _ = c.mdb_cursor_close(cursor);
    _ = c.mdb_txn_commit(txn);

    return arr;
}

pub fn stat(node_env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    return statInternal(node_env, false) catch |err| {
        napi.jsThrow(node_env, @errorName(err));
        return null;
    };
}

pub fn tester(_: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    //

    const selvaDb = selva.selva_db_create();

    std.debug.print("bla {any} \n", .{selvaDb});

    return null;
}
