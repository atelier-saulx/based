const std = @import("std");
const errors = @import("../errors.zig");
const Query = @import("common.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const napi = @import("../napi.zig");

pub fn subscribe(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
    op: t.OpType,
) !void {
    var index: usize = 0;

    const queryId = utils.readNext(u32, buffer, &index);

    // typeId: u16,
    // id: u32,
    // fieldsLen: u8,
    // partialLen: u16,
    // queryLen
    // fields: []const u8,
    // partialFields: []const u8,
    // query

    std.debug.print("derp {any} {any} {any} {any} qid {any} \n", .{ dbCtx, buffer, thread, op, queryId });
    // ----
}

pub fn unsubscribe(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
    op: t.OpType,
) !void {
    // only needs SUB-ID
    std.debug.print("derp {any} {any} {any} {any} \n", .{ dbCtx, buffer, thread, op });
    // ----

}
