const db = @import("../selva/db.zig");
const Thread = @import("../thread/thread.zig");

pub const QueryCtx = struct {
    db: *db.DbCtx,
    thread: *Thread.Thread,
};
