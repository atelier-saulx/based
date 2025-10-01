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
const selva = @import("../../selva.zig");
const vectorLen = std.simd.suggestVectorLength(u8).?;
const zap = @import("roaring");
const Bitmap = zap.Bitmap;

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

//

fn bla() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    var map = std.ArrayHashMap(u32, u32, Context, false).init(allocator);
    defer map.deinit();
    const num_items = 100_000_000;
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
        const bit_index: u3 = @truncate(i % 10_000_000 % 8);
        cnt += (buffer[i / 8] & @as(u8, 1) << bit_index) >> bit_index;
    }
    //

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

    // [0 - 255] (256 /8 => 32)
    // 4 bytes   4 bytes  4 bytes 4 bytes

    // field set
    const buffer3 = try allocator.alloc(u8, 128);

    // const xN: u32 = 213124;
    // var u: u8 = 0;
    // const xx: [4]u8 = @bitCast(xN);
    // // do this branch less as well...
    // while (u < 4) : (u += 1) {
    //     const val = @as(u32, xx[u]) + @as(u32, u) * 255;
    //     const bitIndex = val & (1024 - 1);
    //     const mask = @as(u8, 1) << @as(u3, @truncate(bitIndex % 8));
    //     buffer3[bitIndex / 8] |= mask;
    // }
    timer = try std.time.Timer.start();

    // var prng = std.Random.DefaultPrng.init(blk: {
    //     var seed: u64 = undefined;
    //     try std.posix.getrandom(std.mem.asBytes(&seed));
    //     break :blk seed;
    // });
    // const rand = prng.random();

    // var r1 = try Bitmap.create();

    i = 0;
    while (i < 10_000_000) : (i += 1) {
        const d: u32 = i; //rand.intRangeAtMost(u32, 0, 100_000_000);

        // r1.add(d);

        const xx: [4]u8 = @bitCast(d);
        // const x2: [4]u8 = @bitCast(selva.crc32c(0, &xx, 4));

        // const xx: [4]u8 = @bitCast(selva.crc32c(0, &d, 4));

        inline for (xx, 0..) |byte, u| {
            const bitIndex = (byte + u * 255) & (1023);
            buffer3[bitIndex / 8] |= @as(u8, 1) << @as(u3, @truncate(bitIndex & 7));
        }

        // inline for (x2, 0..) |byte, u| {
        //     const bitIndex = (byte + u * 255) & (1023) + 128 * 8;
        //     buffer3[bitIndex / 8] |= @as(u8, 1) << @as(u3, @truncate(bitIndex & 7));
        // }
    }

    std.debug.print("setting 100M? has time ? {} {any}\n", .{ std.fmt.fmtDuration(timer.read()), cnt });

    timer = try std.time.Timer.start();
    i = 0;
    cnt = 0;
    while (i < 100_000_000) : (i += 1) {
        // if (r1.contains(i)) {
        //     cnt += 1;
        // }
        // const ix: [4]u8 = @bitCast(selva.crc32c(0, &i, 4));

        const ix: [4]u8 = @bitCast(i);
        const h0 = @as(u32, ix[0] % 3);
        const h1 = @as(u32, ix[1] % 8) + 1 * 255;
        const h2 = @as(u32, ix[2] ^ 3) + 2 * 255;
        const h3 = @as(u32, ix[3] << 1) + 3 * 255;
        const b0 = (buffer3[(h0 & (1024 - 1)) / 8] >> (@truncate(h0 % 8))) & 1;
        const b1 = (buffer3[(h1 & (1024 - 1)) / 8] >> (@truncate(h1 % 8))) & 1;
        const b2 = (buffer3[(h2 & (1024 - 1)) / 8] >> (@truncate(h2 % 8))) & 1;
        const b3 = (buffer3[(h3 & (1024 - 1)) / 8] >> (@truncate(h3 % 8))) & 1;
        cnt += b0 & b1 & b2 & b3;

        // const h4 = @as(u32, ix2[0]) + 128 * 8;
        // const h5 = @as(u32, ix2[1]) + 1 * 255 + 128 * 8;
        // const h6 = @as(u32, ix2[2]) + 2 * 255 + 128 * 8;
        // const h7 = @as(u32, ix2[3]) + 3 * 255 + 128 * 8;
        // const b4 = (buffer3[(h4 & (1024 - 1)) / 8] >> (@truncate(h4 % 8))) & 1;
        // const b5 = (buffer3[(h5 & (1024 - 1)) / 8] >> (@truncate(h5 % 8))) & 1;
        // const b6 = (buffer3[(h6 & (1024 - 1)) / 8] >> (@truncate(h6 % 8))) & 1;
        // const b7 = (buffer3[(h7 & (1024 - 1)) / 8] >> (@truncate(h7 % 8))) & 1;
        // cnt += b0 & b1 & b2 & b3 & b4 & b5 & b6 & b7;
    }
    std.debug.print("check 100M? has time ?  {} {any}\n", .{ std.fmt.fmtDuration(timer.read()), cnt });

    //     pub fn simdReferencesHasSingle(
    //     value: u32,
    //     values: []u8,
    // ) bool {
    //     if (values.len < 4) {
    //         return false;
    //     }
    //     const l = values.len / 4;
    //     const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));
    //     return selva.node_id_set_bsearch(tmp, l, value) != -1;
    // }

    // if bloom filter yields result check in array thats ordered by id that returns an index that index has the address of the subs

    // var j:u32 = 0;
    //  while (i < buffer.32) : (i += 1) {
    //     cnt += @popCount(buffer[i]);
    // }

    // const bufferMatrix

    // const h1 = std.hash.Wyhash.hash(self.hash_seed, std.mem.asBytes(&item));
    // prob a lot slower the xx hash

    cnt = 0;
    // has BITMAP (with offset)
    // const min: u32 = 100;
    // const max: u32 = 10e6;

    i = 1e6;

    // const bit_to_add: u1 = if (i >= min and i <= max)
    //     (buffer[@divTrunc(i, 8)] >> @truncate(i % 8)) & 1
    // else
    //     0;

    // cnt += bit_to_add;
    timer = try std.time.Timer.start();

    cnt = 0;
    i = 0;
    while (i < 16_000_000 - vectorLen) : (i += vectorLen) {
        const vec: @Vector(vectorLen, u8) = buffer2[i..][0..vectorLen].*;
        const f: @Vector(vectorLen, u8) = @splat(10); // this is different all the time
        const eq = (vec == f);
        const hasfield = @reduce(.Or, eq);
        if (hasfield) {
            cnt += 1;
        }
    }

    // using selva id has check can be very nice as well vs this - then have a pointer maybe?

    // for subs it would be really nice to only have the cursors in an array
    // maybe prepare this as well? would be nice to have a very aligned thing there
    std.debug.print("SIMD has field (1M times 16 fields) {any} {} {any}\n", .{ vectorLen, std.fmt.fmtDuration(timer.read()), cnt });

    timer = try std.time.Timer.start();
    cnt = 0;

    var idsList = try allocator.alloc(u32, 10_000_000);
    while (i < 10_000_000) : (i += 1) {
        idsList[i] = i;
    }

    timer = try std.time.Timer.start();
    i = 0;
    cnt = 0;
    while (i < 100_000_000) : (i += 1) {
        if (selva.node_id_set_bsearch(@constCast(idsList.ptr), idsList.len, i) != -1) {
            cnt += 1;
        }
    }

    std.debug.print("olli bsearch has field (100M times ) {any} {} {any}\n", .{ vectorLen, std.fmt.fmtDuration(timer.read()), cnt });
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
