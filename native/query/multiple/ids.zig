const utils = @import("../../utils.zig");
const Query = @import("../common.zig");
const t = @import("../../types.zig");
const Node = @import("../../selva/node.zig");
const Iterate = @import("./iterate.zig");
const Sort = @import("../../sort/sort.zig");

pub const IdsIterator = struct {
    ids: []u32,
    i: u32,
    typeEntry: Node.Type,
    pub fn next(self: *IdsIterator) ?Node.Node {
        if (self.i == self.ids.len) {
            return null;
        }
        const node = Node.getNode(self.typeEntry, self.ids[self.i]);
        self.i += 1;
        return node;
    }
};

pub fn ids(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &i);
    const sizeIndex = try ctx.thread.query.reserve(4);
    const size = header.size;
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var it = IdsIterator{ .i = 0, .ids = utils.read([]u32, q, size + 4), .typeEntry = typeEntry };
    var nodeCnt: u32 = 0;
    switch (header.iteratorType) {
        .default => {
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .desc => {
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .sort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var itSort = try Sort.fromIterator(
                false,
                false,
                ctx.db,
                ctx.thread,
                typeEntry,
                &sortHeader,
                &it,
                // .default,
                // undefined,
            );
            nodeCnt = try Iterate.node(.default, ctx, q, &itSort, &header, typeEntry, &i);
            itSort.deinit();
        },
        .descSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var itSort = try Sort.fromIterator(
                true,
                false,
                ctx.db,
                ctx.thread,
                typeEntry,
                &sortHeader,
                &it,
                // .default,
                // undefined,
            );
            nodeCnt = try Iterate.node(.default, ctx, q, &itSort, &header, typeEntry, &i);
            itSort.deinit();
        },
        else => {},
    }
    ctx.thread.query.write(nodeCnt, sizeIndex);
}
