const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const readInt = @import("../utils.zig").readInt;
const mdb = errors.mdb;

pub fn initSort() !void {
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

        const dbName = sort.readData(k);

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

        // means is SORT INDEX
        if (dbName[0] == 254) {
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
                const len: u16 = @intCast(sort.readData(k).len);
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
    }

    _ = c.mdb_cursor_close(cursor);
    try sort.commitTxn(txn);
}
