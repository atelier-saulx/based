const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const std = @import("std");
const db = @import("./db.zig");

pub const SortIndex = struct { dbi: c.MDB_dbi, key: [7]u8, cursor: ?*c.MDB_cursor, queryId: u32 };

pub var sortIndexes = std.AutoHashMap([7]u8, SortIndex).init(db.allocator);

pub fn createOrGetSortIndex(typePrefix: [2]u8, field: u8, start: u16, queryId: u32) ?SortIndex {
    var startCasted: [2]u8 = @bitCast(start);
    if (startCasted[0] == 0 and startCasted[1] != 0) {
        startCasted[0] = 255;
        startCasted[1] = 255 - startCasted[1];
    }
    const name: [7]u8 = .{ 254, typePrefix[0], typePrefix[1], field + 1, startCasted[0] + 1, startCasted[1] + 1, 0 };

    std.debug.print("bla name: {any}, {any} {any} {any} {d} \n", .{
        name,
        typePrefix,
        field,
        start,
        queryId,
    });

    var s = sortIndexes.get(name);
    if (s == null) {
        var dbi: c.MDB_dbi = 0;
        var cursor: ?*c.MDB_cursor = null;

        const txn = db.createTransaction(false) catch {
            return null;
        };

        var flags: c_uint = c.MDB_INTEGERKEY;
        flags |= c.MDB_CREATE;
        // flags |= c.MDB_DUPSORT;
        // flags |= c.MDB_DUPFIXED;
        // flags |= c.MDB_INTEGERDUP;

        errors.mdbCheck(c.mdb_dbi_open(txn, &name, flags, &dbi)) catch |err| {
            std.log.err("1 Cannot open dbi {any} {any}\n", .{ name, err });
            return null;
        };

        var cursortje: ?*c.MDB_cursor = null;
        errors.mdbCheck(c.mdb_cursor_open(txn, dbi, &cursortje)) catch |err| {
            std.log.err("2 Cannot open cursor {any}\n", .{err});
            return null;
        };

        // const nameOrig: [5]u8 = db.createDbiName(typePrefix, field, .{ 0, 0 });

        // const shard = db.getReadShard(nameOrig, queryId);
        // std.debug.print(" flap FROM {any} shard {any} \n", .{ nameOrig, shard });
        // if (shard != null) {
        //     var first: bool = true;
        //     var end: bool = false;
        //     var flag: c_uint = c.MDB_FIRST;

        //     while (!end) {
        //         var k: c.MDB_val = .{ .mv_size = 4, .mv_data = null };
        //         var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        //         errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, flag)) catch |err| {
        //             std.log.err("MEP {any} {any} \n", .{ name, err });

        //             end = true;
        //             break;
        //         };

        //         std.debug.print("ITEM {any} \n", .{@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size]});

        //         // var kkk: c.MDB_val = .{ .mv_size = 4, .mv_data = v.mv_data };
        //         // var kkv: c.MDB_val = .{ .mv_size = 4, .mv_data = k.mv_data };
        //         // errors.mdbCheck(c.mdb_cursor_put(cursortje, &kkk, &kkv, 0)) catch {
        //         //     return null;
        //         // };

        //         if (first) {
        //             first = false;
        //             flag = c.MDB_NEXT;
        //         }
        //     }
        // }

        var flap: u32 = 20;

        var kk: c.MDB_val = .{ .mv_size = 4, .mv_data = &flap };
        var kv: c.MDB_val = .{ .mv_size = 4, .mv_data = &flap };
        errors.mdbCheck(c.mdb_cursor_put(cursortje, &kk, &kv, 0)) catch {
            std.log.err("cannot put", .{});
            return null;
        };

        var kk2: c.MDB_val = .{ .mv_size = 4, .mv_data = &flap };
        var kv2: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        errors.mdbCheck(c.mdb_cursor_get(cursortje, &kk2, &kv2, 0)) catch {
            std.log.err("cannot get", .{});
            return null;
        };

        std.debug.print("XXX name: {any} \n", .{.{@as([*]u8, @ptrCast(kv2.mv_data))[0..kv2.mv_size]}});

        // _ = c.mdb_cursor_close(cursortje);
        errors.mdbCheck(c.mdb_txn_commit(txn)) catch {
            return null;
        };

        var dbi2: c.MDB_dbi = 0;

        const flags2: c_uint = c.MDB_INTEGERKEY;
        const name2: [7]u8 = .{ 254, typePrefix[0], typePrefix[1], field + 1, startCasted[0] + 1, startCasted[1] + 1, 0 };

        // flags2 |= c.MDB_CREATE;

        // flags2 |= c.MDB_DUPSORT;
        // flags2 |= c.MDB_DUPFIXED;
        // flags2 |= c.MDB_INTEGERDUP;

        _ = c.mdb_txn_reset(db.readTxn);
        _ = c.mdb_txn_renew(db.readTxn);

        errors.mdbCheck(c.mdb_dbi_open(db.readTxn, &name2, flags2, &dbi2)) catch |err| {
            std.log.err("3 Cannot open dbi {any} {any}\n", .{ name2, err });
            return null;
        };

        errors.mdbCheck(c.mdb_cursor_open(db.readTxn, dbi2, &cursor)) catch |err| {
            std.log.err("4 Cannot open cursor {any}\n", .{err});
            return null;
        };
        s = .{
            .dbi = dbi2,
            .key = name,
            .queryId = queryId,
            .cursor = cursor,
        };
        sortIndexes.put(name, s.?) catch {
            return null;
        };
    } else if (s.?.queryId != queryId) {
        _ = c.mdb_cursor_renew(db.readTxn, s.?.cursor);
        s.?.queryId = queryId;
    }
    return s;
}
