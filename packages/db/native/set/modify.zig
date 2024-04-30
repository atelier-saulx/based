const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const globals = @import("../globals.zig");
const napi = @import("../napi.zig");
const db = @import("../db.zig");

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
const allocator = arena.allocator();

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return modifyInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes
    // [SIZE 2 bytes] | [1 byte operation] | []

    const args = try napi.getArgs(2, env, info);
    const batch = try napi.getBuffer("modifyBatch", env, args[0]);
    const size = try napi.getInt32("batchSize", env, args[1]);

    var typesAndFields = std.AutoHashMap([3]u8, std.AutoHashMap(u32, []const u8)).init(allocator);

    var i: usize = 0;
    var keySize: u8 = undefined;
    var field: u8 = undefined;
    var type_prefix: [2]u8 = undefined;
    var id: u32 = undefined;
    // var currentShard: u8 = 0;

    var currentNodes: ?std.AutoHashMap(u32, []const u8) = undefined;
    // type_prefix: [2]u8, field: u8, shard: u8

    while (i < size) {
        const operation = batch[i];
        if (operation == 0) {
            // SWITCH FIELD
            field = batch[i + 1];
            keySize = batch[i + 2];

            const typeField = .{ type_prefix[0], type_prefix[1], field };
            std.debug.print("typeField {any}\n", .{typeField});

            currentNodes = typesAndFields.get(typeField);

            if (currentNodes == null) {
                try typesAndFields.put(typeField, std.AutoHashMap(u32, []const u8).init(allocator));
                currentNodes = typesAndFields.get(typeField);
                std.debug.print("make currentNodes {any}", .{typeField});
            }

            i = i + 1 + 2;
        } else if (operation == 1) {
            // SWITCH KEY
            id = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            // todo can be optmized
            // currentShard = @truncate(@divFloor(id, 1_000_000));
            i = i + 1 + 4;
        } else if (operation == 2) {
            // SWITCH TYPE
            type_prefix[0] = batch[i + 1];
            type_prefix[1] = batch[i + 2];

            // std.debug.print("got type selection type: {any}\n", .{type_prefix});
            i = i + 1 + 2;
        } else if (operation == 3) {
            // 4 will be MERGE
            const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);

            // auto copies
            try currentNodes.?.put(id, batch[i + 5 .. i + 5 + operationSize]);

            i = i + operationSize + 1 + 4;
        } else {
            // ERROR
            std.debug.print("SOMETHING WENT WRONG INCORRECT OPERATION!\n", .{});
            break;
        }
    }

    return null;
}
