const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");

pub const Op = enum(u8) {
    update = 0,
    create = 1,
    deleteNode = 2,
    deleteField = 3,
    deleteFieldLang = 4,
};

pub fn checkId(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subTypes) |typeSub| {
        if (typeSub.ids.getEntry(ctx.id)) |entry| {
            ctx.idSubs = entry.value_ptr;
        } else {
            ctx.idSubs = null;
        }
    }
}

pub fn stage(
    ctx: *ModifyCtx,
    comptime op: Op,
) !void {
    if (op != Op.create and op != Op.deleteNode) {
        if (ctx.idSubs) |idSubs| {
            if (idSubs.getEntry(ctx.field)) |entry| {
                var iterator = entry.value_ptr.*.iterator();
                while (iterator.next()) |subIdEntry| {
                    ctx.db.subscriptions.hasMarkedSubscriptions = true;
                    try ctx.db.subscriptions.subscriptionsMarked.put(.{
                        subIdEntry.key_ptr.*,
                        ctx.id,
                    }, undefined);
                }
            }
        }
    }
}
