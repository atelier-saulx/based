const utils = @import("../../utils.zig");
const Query = @import("../common.zig");
const t = @import("../../types.zig");
const Node = @import("../../selva/node.zig");
const Iterate = @import("./iterate.zig");
const Sort = @import("../../sort/sort.zig");

const std = @import("std");

pub const IdsIterator = struct {
    ids: []u32,
    i: u32,
    typeEntry: Node.Type,
    pub fn next(self: *IdsIterator) ?Node.Node {
        if (self.i == self.ids.len) {
            return null;
        }
        if (Node.getNode(self.typeEntry, self.ids[self.i])) |node| {
            self.i += 1;
            return node;
        }
        self.i += 1;
        return self.next();
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
    var it = IdsIterator{ .i = 0, .ids = utils.read([]u32, q[i .. i + size], 0), .typeEntry = typeEntry };
    var nodeCnt: u32 = 0;
    i += size;
    switch (header.iteratorType) {
        .default => {
            nodeCnt = try Iterate.node(.default, ctx, q, &it, &header, typeEntry, &i);
        },
        .filter => {
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, &i);
        },
        .filterSort => {
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
            nodeCnt = try Iterate.node(.filter, ctx, q, &itSort, &header, typeEntry, &i);
            itSort.deinit();
            // make filtered iterator
        },
        .descFilterSort => {
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
            nodeCnt = try Iterate.node(.filter, ctx, q, &itSort, &header, typeEntry, &i);
            itSort.deinit();
            // derp
            // make filtered iterator
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
