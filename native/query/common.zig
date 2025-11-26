const DbCtx = @import("../db/ctx.zig").DbCtx;
const Thread = @import("../thread/thread.zig");

pub const QueryCtx = struct {
    db: *DbCtx,
    thread: *Thread.Thread,
};
