const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");

pub const Result = struct { id: ?u32, field: u8, val: ?c.MDB_val, fromId: ?u32 };

pub const QueryItemCtx = struct { id: *u32, fromId: ?u32, include: []u8, includeSingleRefs: []u8, type_prefix: [2]u8, mainLen: usize, currentShard: u16, shards: *std.AutoHashMap([5]u8, db.Shard), txn: ?*c.MDB_txn, results: *std.ArrayList(Result) };

pub fn getFields(ctx: QueryItemCtx) !usize {
    var size: usize = 0;
    var includeIterator: u8 = 0;
    includeField: while (includeIterator < ctx.include.len) {
        const field: u8 = ctx.include[includeIterator];
        includeIterator += 1;
        const dbiName = db.createDbiName(ctx.type_prefix, field, @bitCast(ctx.currentShard));
        var shard = ctx.shards.get(dbiName);

        if (shard == null) {
            shard = db.openShard(true, dbiName, ctx.txn) catch null;
            if (shard != null) {
                try ctx.shards.put(dbiName, shard.?);
            }
        }

        var k: c.MDB_val = .{ .mv_size = 4, .mv_data = ctx.id };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
            continue :includeField;
        };

        if (includeIterator == 1 and ctx.fromId == null) {
            size += 1 + 4;
            const s: Result = .{ .id = ctx.id.*, .field = field, .val = v, .fromId = ctx.fromId };
            try ctx.results.append(s);
        } else {
            const s: Result = .{ .id = null, .field = field, .val = v, .fromId = ctx.fromId };
            try ctx.results.append(s);
        }

        if (field != 0) {
            size += (v.mv_size + 1 + 2);
        } else {
            if (v.mv_size > 0 and ctx.includeSingleRefs.len != 0) {
                var refI: usize = 0;
                // refLoop:
                while (refI < ctx.includeSingleRefs.len) {
                    const len = std.mem.readInt(u16, ctx.includeSingleRefs[refI..][0..2], .little);
                    const t: [2]u8 = .{ ctx.includeSingleRefs[refI + 2], ctx.includeSingleRefs[refI + 3] };
                    const start = std.mem.readInt(u16, ctx.includeSingleRefs[refI + 4 ..][0..2], .little);
                    const mainSlice = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
                    const refId = std.mem.readInt(u32, mainSlice[start..][0..4], .little);
                    std.debug.print("yo-> LEN: {d} t: {any} start: {d} len: {d} refId: {d}  id: {d} \n", .{ len, t, start, mainSlice.len, refId, ctx.id[0..1] });
                    refI += len + 6;

                    // --> make more here add struct
                    // refI +=   ;
                    // getFields(results, id, true, )
                }

                // get id
                // buffer copy for single ref selection
                // then main
                // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]
                // put while loop
            }

            if (ctx.mainLen != 0) {
                size += (ctx.mainLen + 1);
            } else {
                size += (v.mv_size + 1);
            }
        }
    }

    return size;
}
