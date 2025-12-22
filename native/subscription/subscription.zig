const std = @import("std");
const errors = @import("../errors.zig");
const Query = @import("common.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub fn subscribe(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
    op: t.OpType,
) void {
    std.debug.print("derp {any} {any} {any} {any} \n", .{ dbCtx, buffer, thread, op });
    // ----
}

pub fn unsubscribe(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
    op: t.OpType,
) void {
    std.debug.print("derp {any} {any} {any} {any} \n", .{ dbCtx, buffer, thread, op });
    // ----

}
