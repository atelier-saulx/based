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

pub fn addMultiSubscriptionInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {

    // [type][type]
    // [subId][subId][subId][subId]

    const args = try napi.getArgs(2, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    const value = try napi.get([]u8, env, args[1]);
    const typeId = utils.read(u16, value, 0);
    // const subId = utils.read(u32, value, 2);

    var typeSubs = try upsertSubType(ctx, typeId);

    typeSubs.multiSubsSize += 1;
    typeSubs.multiSubsSizeBits = (typeSubs.multiSubsSize + 8 - 1) / 8; // TODO in zig 0.15 replace with @divCeil

    typeSubs.multiSubsStageMarked = try std.heap.raw_c_allocator.realloc(
        typeSubs.multiSubsStageMarked,
        typeSubs.multiSubsSizeBits,
    );

    // typeSubs.multiSubsStageMarked[typeSubs.multiSubsSize - 1] = 0;

    typeSubs.multiSubs = try std.heap.raw_c_allocator.realloc(
        typeSubs.multiSubs,
        typeSubs.multiSubsSize * types.SUB_SIZE, // only fields for now...
    );

    // utils.read(u32, idSubs, i + 4)
    // utils.writeInt(u32, typeSubs.multiSubs, typeSubs.multiSubsSize * types.SUB_SIZE + 4, subId);
    // typeSubs.multiSubs[]

    // std.debug.print("DERP typeId: {any} subId: {any} \n", .{ typeId, subId });

    return null;
}

pub fn removeMultiSubscriptionInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    // const args = try napi.getArgs(2, napi_env, info);
    // const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    // const value = try napi.get([]u8, napi_env, args[1]);

    // const subId = utils.read(u64, value, 0);
    // const typeId = utils.read(u16, value, 8);

    // if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
    //
    // }
    return null;
}
