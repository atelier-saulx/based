const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const results = @import("./results.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;

pub fn getFields(ctx: QueryCtx, id: u32, fromId: ?u32) !usize {
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

        var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
            continue :includeField;
        };

        if (includeIterator == 1 and fromId == null) {
            size += 1 + 4;
            const s: results.Result = .{ .id = id, .field = field, .val = v, .fromId = fromId };
            try ctx.results.append(s);
        } else {
            const s: results.Result = .{ .id = null, .field = field, .val = v, .fromId = fromId };
            try ctx.results.append(s);
        }

        if (field != 0) {
            size += (v.mv_size + 1 + 2);
        } else {
            if (v.mv_size > 0 and ctx.includeSingleRefs.len != 0) {
                // var refI: usize = 0;
                // // refLoop:
                // while (refI < ctx.includeSingleRefs.len) {
                //     const len = std.mem.readInt(u16, ctx.includeSingleRefs[refI..][0..2], .little);
                //     const t: [2]u8 = .{ ctx.includeSingleRefs[refI + 2], ctx.includeSingleRefs[refI + 3] };
                //     const start = std.mem.readInt(u16, ctx.includeSingleRefs[refI + 4 ..][0..2], .little);
                //     const mainSlice = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
                //     const refId = std.mem.readInt(u32, mainSlice[start..][0..4], .little);
                //     std.debug.print("yo-> LEN: {d} t: {any} start: {d} len: {d} refId: {d}  id: {d} \n", .{ len, t, start, mainSlice.len, refId, ctx.id[0..1] });
                //     refI += len + 6;

                //     // --> make more here add struct
                //     // refI +=   ;
                //     // getFields(results, id, true, )
                // }

                // // get id
                // // buffer copy for single ref selection
                // // then main
                // // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]
                // // put while loop
            }

            if (ctx.includeMain.len != 0) {
                size += std.mem.readInt(u32, ctx.includeMain[0..4], .little) + 1;
            } else {
                size += (v.mv_size + 1);
            }
        }
    }

    return size;
}
