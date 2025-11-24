const db = @import("../db/db.zig");

pub const QueryCtx = struct {
    db: *db.DbCtx,
    threadCtx: *db.DbThread,
};
