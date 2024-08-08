const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const Env = @import("./env.zig");

const mdbCheck = errors.mdbCheck;
const jsThrow = errors.jsThrow;

pub fn statInternal() !c.MDB_stat {
    var s: c.MDB_stat = undefined;
    var txn: ?*c.MDB_txn = null;
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;

    try mdbCheck(c.mdb_txn_begin(Env.env, null, c.MDB_RDONLY, &txn));
    try mdbCheck(c.mdb_dbi_open(txn, null, 0, &dbi));
    try mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));

    var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
    var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
    var dbi2: c.MDB_dbi = 0;

    mdbCheck(c.mdb_cursor_get(cursor, &k, &v, c.MDB_FIRST)) catch {};
    mdbCheck(c.mdb_dbi_open(txn, @as([*]u8, @ptrCast(k.mv_data)), c.MDB_INTEGERKEY, &dbi2)) catch |err| {
        std.debug.print("NO DBI {any} DBI {any} \n", .{ err, @as([*]u8, @ptrCast(k.mv_data))[0..k.mv_size] });
    };
    _ = c.mdb_stat(txn, dbi2, &s);
    _ = c.mdb_dbi_close(Env.env, dbi2);

    var size = s.ms_psize * (s.ms_branch_pages + s.ms_leaf_pages + s.ms_overflow_pages);
    var dbiCnt: usize = 1;
    var entries: usize = s.ms_entries;
    std.debug.print("DBI {any} size {d}MB \n", .{ @as([*]u8, @ptrCast(k.mv_data))[0..k.mv_size], @divTrunc(size, 1000 * 1000) });
    var done: bool = false;
    while (!done) {
        mdbCheck(c.mdb_cursor_get(cursor, &k, &v, c.MDB_NEXT)) catch {
            done = true;
            break;
        };
        if (k.mv_size == 0) {
            done = true;
            break;
        }
        mdbCheck(c.mdb_dbi_open(txn, @as([*]u8, @ptrCast(k.mv_data)), c.MDB_INTEGERKEY, &dbi2)) catch |err| {
            std.debug.print("NO DBI {any} DBI {any} \n", .{ err, @as([*]u8, @ptrCast(k.mv_data))[0..k.mv_size] });
            done = true;
            break;
        };
        _ = mdbCheck(c.mdb_stat(txn, dbi2, &s)) catch |err| {
            std.debug.print("STAT ERROR {any} \n", .{err});
        };
        dbiCnt += 1;
        entries += s.ms_entries;
        _ = c.mdb_dbi_close(Env.env, dbi2);
        const dbiSize = s.ms_psize * (s.ms_branch_pages + s.ms_leaf_pages + s.ms_overflow_pages);
        size += dbiSize;
        std.debug.print("DBI {any} size {d}MB \n", .{ @as([*]u8, @ptrCast(k.mv_data))[0..k.mv_size], @divTrunc(dbiSize, 1000 * 1000) });
    }

    std.debug.print("DBIS {d} entries {d} size {d}mb \n", .{ dbiCnt, entries, @divTrunc(size, 1000 * 1000) });

    _ = c.mdb_cursor_close(cursor);
    _ = c.mdb_txn_commit(txn);

    return s;
}

pub fn stat(node_env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    _ = statInternal() catch |err| {
        napi.jsThrow(node_env, @errorName(err));
        return null;
    };
    return null;
}
