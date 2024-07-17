const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const runCondition = @import("./conditions.zig").runConditions;
const fields = @import("./getFields.zig");

pub fn getQuery(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn getQueryInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
) !c.napi_value {
    const args = try napi.getArgs(8, env, info);
    const conditions = try napi.getBuffer("conditions", env, args[0]);
    const type_prefix = try napi.getStringFixedLength("type", 2, env, args[1]);
    const last_id = try napi.getInt32("last_id", env, args[2]);
    const offset = try napi.getInt32("offset", env, args[3]);
    const limit = try napi.getInt32("limit", env, args[4]);
    const include = try napi.getBuffer("include", env, args[5]);
    const mainIncludes = try napi.getBuffer("mainIncludes", env, args[6]);
    const includeSingleRefs = try napi.getBuffer("includeSingleRefs", env, args[7]);
    const selectiveMain = mainIncludes[0] != 0;
    var mainLen: usize = undefined;

    if (selectiveMain) {
        mainLen = std.mem.readInt(u32, mainIncludes[1..5], .little);
    }

    const includeSingleRefsBool = includeSingleRefs[0] != 0;
    var includeRefsLen: usize = undefined;

    if (includeSingleRefsBool) {
        includeRefsLen = std.mem.readInt(u32, includeSingleRefs[1..5], .little);
    }

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var shards = std.AutoHashMap([5]u8, db.Shard).init(allocator);
    defer {
        var it = shards.iterator();
        while (it.next()) |shard| {
            db.closeShard(shard.value_ptr);
        }
    }
    const txn = try db.createTransaction(true);

    var results = std.ArrayList(fields.Result).init(allocator);

    var i: u32 = offset + 1;
    var currentShard: u16 = 0;
    var total_results: usize = 0;
    var total_size: usize = 0;

    checkItem: while (i <= last_id and total_results < offset + limit) : (i += 1) {
        if (i > (@as(u32, currentShard + 1)) * 1_000_000) {
            currentShard += 1;
        }
        var fieldIndex: usize = 0;

        // fn for conditions
        while (fieldIndex < conditions.len) {
            const querySize: u16 = std.mem.readInt(
                u16,
                conditions[fieldIndex + 1 ..][0..2],
                .little,
            );
            const field = conditions[fieldIndex];
            const dbiName = db.createDbiName(type_prefix, field, @bitCast(currentShard));

            var shard = shards.get(dbiName);

            if (shard == null) {
                shard = db.openShard(true, dbiName, txn) catch null;
                if (shard != null) {
                    try shards.put(dbiName, shard.?);
                }
            }
            if (shard != null) {
                const query = conditions[fieldIndex + 3 .. fieldIndex + 3 + querySize];
                var k: c.MDB_val = .{ .mv_size = 4, .mv_data = null };
                k.mv_data = &i;
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
                    continue :checkItem;
                };
                if (!runCondition(@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size], query)) {
                    continue :checkItem;
                }
            } else {
                continue :checkItem;
            }

            fieldIndex += querySize + 3;
        }

        // go go go
        total_size += try fields.getFields(&results, &i, include, type_prefix, selectiveMain, includeSingleRefsBool, mainLen, currentShard, &shards, txn);

        total_results += 1;
    }
    total_size += 4;

    var data: ?*anyopaque = undefined;

    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_size, &data, &result) != c.napi_ok) {
        return null;
    }

    var dataU8 = @as([*]u8, @ptrCast(data));

    const s: [4]u8 = @bitCast(@as(u32, @truncate(total_results)));
    dataU8[0] = s[0];
    dataU8[1] = s[1];
    dataU8[2] = s[2];
    dataU8[3] = s[3];

    var last_pos: usize = 4;

    for (results.items) |*key| {
        if (key.id != null) {
            dataU8[last_pos] = 255;
            last_pos += 1;
            @memcpy(dataU8[last_pos .. last_pos + 4], @as([*]u8, @ptrCast(&key.id)));
            last_pos += 4;
        }
        @memcpy(dataU8[last_pos .. last_pos + 1], @as([*]u8, @ptrCast(&key.field)));
        last_pos += 1;
        if (key.field == 0) {
            if (selectiveMain) {
                var selectiveMainPos: usize = 5;
                var mainU8 = @as([*]u8, @ptrCast(key.val.?.mv_data));
                while (selectiveMainPos < mainIncludes.len) {
                    const start: u16 = std.mem.readInt(u16, @ptrCast(mainIncludes[selectiveMainPos .. selectiveMainPos + 2]), .little);
                    const len: u16 = std.mem.readInt(u16, @ptrCast(mainIncludes[selectiveMainPos + 2 .. selectiveMainPos + 4]), .little);
                    const end: u16 = len + start;
                    @memcpy(dataU8[last_pos .. last_pos + len], mainU8[start..end].ptr);
                    last_pos += len;
                    selectiveMainPos += 4;
                }
            } else {
                @memcpy(
                    dataU8[last_pos .. last_pos + key.val.?.mv_size],
                    @as([*]u8, @ptrCast(key.val.?.mv_data)),
                );
                last_pos += key.val.?.mv_size;
            }
        } else {
            const x: [2]u8 = @bitCast(@as(u16, @truncate(key.val.?.mv_size)));
            dataU8[last_pos] = x[0];
            dataU8[last_pos + 1] = x[1];
            last_pos += 2;
            @memcpy(
                dataU8[last_pos .. last_pos + key.val.?.mv_size],
                @as([*]u8, @ptrCast(key.val.?.mv_data)),
            );
            last_pos += key.val.?.mv_size;
        }
    }

    try errors.mdbCheck(c.mdb_txn_commit(txn));

    return result;
}
