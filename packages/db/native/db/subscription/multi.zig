const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const types = @import("./types.zig");
const t = @import("../../types.zig");
const upsertSubType = @import("./shared.zig").upsertSubType;
const removeSubTypeIfEmpty = @import("./shared.zig").removeSubTypeIfEmpty;

const vectorLen = std.simd.suggestVectorLength(u8).?;

const SubRecord = packed struct {
    sub_id: u32,
    marker: u8,
    // f1: u8,
    // f2: u8,
    // f3: u8,
    total_ids: u32,
    total_ids_copy: u32,
};

pub const Context = struct {
    pub fn hash(_: Context, d: u32) u32 {
        return d;
    }

    pub fn eql(_: Context, x: u32, y: u32, _: usize) bool {
        //  _: usize
        return x == y;
    }
};

fn bla() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    var map = std.ArrayHashMap(u32, u32, Context, false).init(allocator);
    defer map.deinit();
    const num_items = 1_000_000_000;
    const buffer_size = (num_items + 7) / 8;
    const buffer = try allocator.alloc(u8, buffer_size);
    defer allocator.free(buffer);

    // set all bit to 1 bitmaps ftw
    @memset(buffer, 255);
    // keep track of lowest and highest
    // const lowBound: u32 = 5_000_000;
    // const highBound: u32 = 35_000_000;
    var i: u32 = 0;
    var timer = try std.time.Timer.start();
    var cnt: u32 = 0;

    // fields def like this
    // max 1 vector else we count it as all

    // this type of stuff is really fast scince it gets optmized in 1 instruction
    while (i < num_items) : (i += 1) {
        const byte_index = i / 8;
        const bit_index: u3 = @truncate(i % 8);
        const mask = @as(u8, 1) << bit_index;
        if ((buffer[byte_index] & mask) != 0) {
            cnt += 1;
        }
    }
    std.debug.print("{} {any}\n", .{ std.fmt.fmtDuration(timer.read()), cnt });

    timer = try std.time.Timer.start();
    cnt = 0;
    i = 0;
    // i u32
    // if (i )
    while (i < buffer.len - vectorLen) : (i += vectorLen) {
        const vec: @Vector(vectorLen, u8) = buffer[i..][0..vectorLen].*;
        const popCount: @Vector(vectorLen, u8) = @popCount(vec);
        cnt += @reduce(.Add, popCount);
    }
    while (i < buffer.len) : (i += 1) {
        cnt += @popCount(buffer[i]);
    }

    std.debug.print("SIMD {any} {} {any}\n", .{ vectorLen, std.fmt.fmtDuration(timer.read()), cnt });

    const buffer2 = try allocator.alloc(u8, 1_000_000 * vectorLen);
    var x: u8 = 0;
    while (x < vectorLen) : (x += 1) {
        buffer2[x] = x + 1;
    }

    timer = try std.time.Timer.start();
    cnt = 0;
    i = 0;

    while (i < 16_000_000 - vectorLen) : (i += vectorLen) {
        const vec: @Vector(vectorLen, u8) = buffer2[i..][0..vectorLen].*;

        const f: @Vector(vectorLen, u8) = @splat(10);
        const eq = (vec == f);
        const hasfield = @reduce(.Or, eq);
        if (hasfield) {
            cnt += 1;
        }
    }

    std.debug.print("SIMD has field {any} {} {any}\n", .{ vectorLen, std.fmt.fmtDuration(timer.read()), cnt });
}

pub fn addMultiSubscriptionInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    try bla();
    // const args = try napi.getArgs(2, napi_env, info);
    // const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    // const value = try napi.get([]u8, napi_env, args[1]);
    // const headerLen = 22;
    // const subId = utils.read(u64, value, 0);
    // const typeId = utils.read(u16, value, 8);

    // // if (rangeType == t.Prop.NULL) {
    // // const id1 = utils.read(u32, value, 11);
    // // const id2 = utils.read(u32, value, 15);
    // const hasFullRange = value[19] == 1;

    // const filterLen = utils.read(u16, value, 20);

    // std.debug.print("addMultiSubscriptionInternal: {any}  filterLen {any} \n", .{ value, filterLen });

    // const fields = value[headerLen + filterLen .. value.len];

    // var typeSubscriptionCtx = try upsertSubType(ctx, typeId);
    // var sub: *types.Subscription = undefined;

    // if (!typeSubscriptionCtx.subs.contains(subId)) {
    //     sub = try ctx.allocator.create(types.Subscription);
    //     sub.* = .{
    //         .subType = types.SubType.simpleMulti,
    //         .ids = types.Ids.init(ctx.allocator),
    //         .fields = types.Fields.init(ctx.allocator),
    //         .hasFullRange = hasFullRange,
    //         .filters = null,
    //         .stagedIds = null,
    //         .id = subId,
    //     };
    //     try typeSubscriptionCtx.subs.put(subId, sub);
    //     try typeSubscriptionCtx.nonMarkedMulti.put(subId, sub);
    //     for (fields) |f| {
    //         try sub.fields.put(f, undefined);
    //     }
    // } else {
    //     sub = typeSubscriptionCtx.subs.get(subId).?;
    //     sub.*.hasFullRange = hasFullRange;
    // }

    return null;
}

pub fn removeMultiSubscriptionInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    // const args = try napi.getArgs(2, napi_env, info);
    // const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    // const value = try napi.get([]u8, napi_env, args[1]);

    // const subId = utils.read(u64, value, 0);
    // const typeId = utils.read(u16, value, 8);

    // if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
    //     if (typeSubscriptionCtx.subs.fetchRemove(subId)) |removedMultiContainer| {
    //         // if (removedMultiContainer.value.filters) |f| {
    //         //     var filterIterator = f.iterator();
    //         //     while (filterIterator.next()) |filter| {
    //         //         std.debug.print("this is a FILTER {any} \n", .{filter});
    //         //         // ctx.allocator.destroy(filter.value_ptr.*);
    //         //         // _ = f.remove(filter.key_ptr.*);
    //         //     }
    //         //     // ctx.allocator.destroy(f.*);
    //         //     // f.deinit();
    //         // }

    //         // Remove individual ids as well
    //         removedMultiContainer.value.ids.deinit();

    //         // Fields remove
    //         removedMultiContainer.value.fields.deinit();

    //         ctx.allocator.destroy(removedMultiContainer.value);
    //         _ = typeSubscriptionCtx.nonMarkedMulti.remove(subId);
    //     }

    //     removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
    // }
    return null;
}
