const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const types = @import("./types.zig");
const upsertSubType = @import("./upsertType.zig").upsertSubType;

pub fn addIdSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 14;
    const subId = utils.read(u64, value, 0);
    const typeId = utils.read(u16, value, 8);
    const id = utils.read(u32, value, 10);
    const fields = value[headerLen..value.len];
    var typeSubscriptionCtx = try upsertSubType(ctx, typeId);
    if (!typeSubscriptionCtx.ids.contains(id)) {
        const singleId = try ctx.allocator.create(types.SingleId);
        singleId.* = .{
            .fields = types.Fields.init(ctx.allocator),
        };
        try typeSubscriptionCtx.ids.put(id, singleId);
    }
    var idContainer = typeSubscriptionCtx.ids.get(id).?;
    for (fields) |f| {
        if (!idContainer.fields.contains(f)) {
            const fSubIds = try ctx.allocator.create(types.SubIds);
            fSubIds.* = types.SubIds.init(ctx.allocator);
            try idContainer.fields.put(f, fSubIds);
        }
        if (idContainer.fields.get(f)) |fieldsSubIds| {
            try fieldsSubIds.put(subId, undefined);
        }
    }
    return null;
}

pub fn removeIdSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 14;
    const subId = utils.read(u64, value, 0);
    const typeId = utils.read(u16, value, 8);
    const id = utils.read(u32, value, 10);
    const fields = value[headerLen..value.len];
    if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
        std.debug.print("AMOUNT OF SUBS {any} \n", .{typeSubscriptionCtx.ids.count()});

        if (typeSubscriptionCtx.ids.get(id)) |idContainer| {
            for (fields) |f| {
                if (idContainer.fields.get(f)) |fieldsSubIds| {
                    _ = fieldsSubIds.remove(subId);
                    if (fieldsSubIds.count() == 0) {
                        if (idContainer.fields.fetchRemove(f)) |removed_entry| {
                            removed_entry.value.deinit();
                            ctx.allocator.destroy(removed_entry.value);
                        }
                    }
                }
            }
            if (idContainer.fields.count() == 0) {
                if (typeSubscriptionCtx.ids.fetchRemove(id)) |removed_entry| {
                    removed_entry.value.fields.deinit();
                    ctx.allocator.destroy(removed_entry.value);
                }
            }
        }
        if (typeSubscriptionCtx.ids.count() == 0) {
            if (ctx.subscriptions.types.fetchRemove(typeId)) |removed_entry| {
                removed_entry.value.ids.deinit();
                ctx.allocator.destroy(removed_entry.value);
            }
        }
    }
    return null;
}
