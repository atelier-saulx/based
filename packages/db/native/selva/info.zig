const db = @import("db.zig");
const selva = @import("selva.zig").c;
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");

pub fn blockHash(threadCtx: *Thread.DbThread, ctx: *db.DbCtx, q: []u8, op: t.OpType) !void {
    const id = utils.read(u32, q, 0);
    const data = try Thread.newResult(true, threadCtx, 20, id, op);
    const start = utils.read(u32, q, 0);
    const typeCode = utils.read(u16, q, 4);
    const typeEntry = selva.selva_get_type_by_index(ctx.selva.?, typeCode);
    var err: c_int = selva.SELVA_EINTYPE;
    if (typeEntry) |te| {
        var hash: SelvaHash128 = 0;
        err = db.getNodeBlockHash(ctx, te, start, &hash);
        utils.byteCopy(data, &hash, 4);
    }
    utils.write(data, err, 0);
}
