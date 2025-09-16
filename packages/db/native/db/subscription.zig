const std = @import("std");
const db = @import("./db.zig");
const DbCtx = @import("./ctx.zig").DbCtx;
const napi = @import("../napi.zig");
const c = @import("../c.zig");
const utils = @import("../utils.zig");

// optmize this later using C this does not make sense in perf
// 32mb ram for 1M subscriptions adds 24 bytes extra per row but does take away non pointer lookup
// do we want to include START for main buffers?
pub const Bitmap255 = struct {
    pub const capacity = 255;
    const storage_size = (capacity + 7) / 8;
    data: [storage_size]u8 = .{0} ** storage_size,
    const Self = @This();
    pub fn setValue(self: *Self, option: u8) void {
        std.debug.assert(option < capacity);
        const index = @as(usize, option >> 3);
        const mask = @as(u8, 1) << (option & 7);
        self.data[index] |= mask;
    }
    pub fn hasValue(self: *const Self, option: u8) bool {
        std.debug.assert(option < capacity);
        const index = @as(usize, option >> 3);
        const mask = @as(u8, 1) << (option & 7);
        return (self.data[index] & mask) != 0;
    }
};

// [type u16]

// start / end
pub const SingleId = struct {
    // specificMain: ?std.AutoHashMap(u16, u16),
    // specificMain? is this important at all for single ids in real scenarios
    // if not the bitmap technique is prob better scince the lookup is a lot faster porbably
    fields: std.AutoHashMap(u8, void),
    subIds: std.AutoHashMap(u64, void),
};

pub const TypeSubscriptionCtx = struct {
    ids: std.AutoHashMap(u32, SingleId),
};

pub const TypeSubMap = std.AutoHashMap(u16, TypeSubscriptionCtx);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    subscriptionsMarked: std.AutoHashMap(u64, void),
    hasMarkedSubscriptions: bool,
};

pub fn resetMarkedSubscriptions(ctx: *DbCtx) !void {
    std.debug.print("reset market {any} ", .{ctx});
    const markedSubs = ctx.subscriptions.subscriptionsMarked;
    //  ctx.subscriptions.subscriptionsMarked.

    var keyIter = markedSubs.keyIterator();
    while (keyIter.next()) |key| {
        markedSubs.remove(key);
        // ctx.allocator.free(key.*);
    }
}

fn addIdSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 14;

    // std.debug.print("{any} \n", .{value});

    const subId = utils.read(u64, value, 0);
    const typeId = utils.read(u16, value, 8);
    const id = utils.read(u32, value, 10);
    const fields = value[headerLen..value.len];

    // typeIndexes = try dbCtx.allocator.create(TypeIndex);

    if (!ctx.subscriptions.types.contains(typeId)) {
        // const
        // ctx.subscriptions.ids.set(id);
        std.debug.print("DONT HAVE TYPE {any} \n", .{typeId});
    }

    //
    // std.debug.print("b {any} \n", .{ id, subId });

    // const fields = try napi.get([]u8, napi_env, args[3]);
    std.debug.print("addIdSubscription: typeId:{any} id:{any} subId:{any} fields:{any} \n", .{
        typeId,
        id,
        subId,
        fields,
        // ctx.subscriptions.ids,
    });
    return null;
}

pub fn addIdSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return addIdSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addIdSubscription {any} \n", .{err});
        return null;
    };
}

// pub fn removeIdSubscription(ctx: DbCtx, id: u32, subId: u64, fields: u8) !void {
//     // const fieldLen = fields[0]
// }

// pub const SubscriptionCtx = struct { ids: std.AutoHashMap(u32, Bitmap255) };
// prob want to store start index as well
// for this we want to send back which subscription is interested in the value
// that means this does not work

// id -> yes -> field -> yes -> check if field is updated (different check) -> yes - map to sub id?
// so we need another field that gets written to say field updated ?
// and then do a maunaul check at the end to see which sub id updayed?

// -----------------------------------------------------------
// SINGLE ID
// if !create (cannot be subscribed on create?)
// if TYPE
// if ID ->
// -> field yes
//    -> if main
//      -> if has start if or all
// -> if updated
//  ->  MARK
// after all this you set it

// MULTI ID
// if TYPE
// -> sub cnt > 0
// -> field yes
//    -> if main
//      -> if has start or all include
// -> if part of filter (cnt) if part of include (both)
//    -> filter result is different
// -> if updated
// if SUB ID has filter then check if is part of filter (LATER how to check for range?)
//  ->  MARK and sub cnt-- // substract each leaf as well for each mark that matches

// reset the sub cnt to the actual cnt

// subID mark HASMAP 8 bytes QUERY IDS
// adds extra arg to modify which is the BUFFER in node js
// start as argument to modify

// -----------------------------------------------------------
// function ADD sub single id
// function REMOVE SUB single id

// function ADD sub multi id - has option filter
// function REMOVE SUB ID multi id
