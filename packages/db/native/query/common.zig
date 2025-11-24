const db = @import("../selva/db.zig");

pub const QueryCtx = struct {
    db: *db.DbCtx,
    thread: *db.DbThread,
};
