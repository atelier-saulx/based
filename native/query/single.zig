const std = @import("std");
const utils = @import("../utils.zig");
const Query = @import("common.zig");
const Include = @import("include/include.zig");
const Node = @import("../selva/node.zig");
const References = @import("../selva/references.zig");
const Selva = @import("../selva/selva.zig");
const Thread = @import("../thread/thread.zig");
const Schema = @import("../selva/schema.zig");
const t = @import("../types.zig");
const Fields = @import("../selva/fields.zig");
const Filter = @import("filter/filter.zig");

// alias filter needs to be added
// make that top level

pub fn alias(
    comptime hasFilter: bool,
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.readNext(t.QueryHeaderSingle, q, &i);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    const aliasValue = utils.sliceNext(header.aliasSize, q, &i);
    if (Fields.getAliasByName(typeEntry, header.prop, aliasValue)) |node| {
        if (hasFilter) {
            try ctx.thread.query.append(@as(u32, 0));
            // do stuff
        }
        try ctx.thread.query.append(@as(u32, 1));
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(Node.getNodeId(node));
        const nestedQuery = q[i .. i + header.includeSize];
        try Include.include(node, ctx, nestedQuery, typeEntry);
    } else {
        try ctx.thread.query.append(@as(u32, 0));
    }
    // i.* += header.includeSize; not nessecary for default
}

pub fn default(
    comptime hasFilter: bool,
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.readNext(t.QueryHeaderSingle, q, &i);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    if (Node.getNode(typeEntry, header.id)) |node| {
        if (hasFilter) {
            const filter = utils.sliceNext(header.filterSize, q, &i);
            try Filter.prepare(filter, ctx, typeEntry);
            if (!try Filter.filter(node, ctx, filter)) {
                try ctx.thread.query.append(@as(u32, 0));
                return;
            }
        }
        try ctx.thread.query.append(@as(u32, 1));
        try ctx.thread.query.append(t.ReadOp.id);
        try ctx.thread.query.append(header.id);
        const nestedQuery = q[i .. i + header.includeSize];

        try Include.include(node, ctx, nestedQuery, typeEntry);
    } else {
        try ctx.thread.query.append(@as(u32, 0));
    }
}

// prob add REF+EDGE include as an option
pub fn reference(
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
) !void {
    const header = utils.readNext(t.QueryHeaderSingleReference, q, i);
    const fs = try Schema.getFieldSchema(fromType, header.prop);
    if (References.getReference(from, fs)) |ref| {
        const typeEntry = try Node.getType(ctx.db, header.typeId);
        const n = Node.getNode(typeEntry, ref.dst);
        try ctx.thread.query.append(t.ReadOp.reference);
        try ctx.thread.query.append(header.prop);
        const resultByteSizeIndex = try ctx.thread.query.reserve(4);
        const startIndex = ctx.thread.query.index;
        if (n) |node| {
            try ctx.thread.query.append(ref.dst);
            const nestedQuery = q[i.* .. i.* + header.includeSize];
            try Include.include(node, ctx, nestedQuery, typeEntry);
        }
        ctx.thread.query.writeAs(
            u32,
            @truncate(ctx.thread.query.index - startIndex),
            resultByteSizeIndex,
        );
    }
    i.* += header.includeSize;
}

pub fn referenceEdge(
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
) !void {
    const header = utils.readNext(t.QueryHeaderSingleReference, q, i);
    const fs = try Schema.getFieldSchema(fromType, header.prop);
    if (References.getReference(from, fs)) |ref| {
        const typeEntry = try Node.getType(ctx.db, header.typeId);
        const n = Node.getNode(typeEntry, ref.dst);

        if (n) |node| {
            try ctx.thread.query.append(t.ReadOp.reference);
            try ctx.thread.query.append(header.prop);
            const resultByteSizeIndex = try ctx.thread.query.reserve(4);
            const startIndex = ctx.thread.query.index;
            try ctx.thread.query.append(ref.dst);
            const nestedQuery = q[i.* .. i.* + header.includeSize];
            try Include.include(node, ctx, nestedQuery, typeEntry);

            // handle this case
            // if ref.edge == 0

            const edgeTypeEntry = try Node.getType(ctx.db, header.edgeTypeId);
            const e = Node.getNode(edgeTypeEntry, ref.edge);

            if (e) |edge| {
                const edgeQuery = q[i.* + header.includeSize .. i.* + header.includeSize + header.edgeSize];
                try ctx.thread.query.append(t.ReadOp.edge);
                const edgesByteSizeIndex = try ctx.thread.query.reserve(4);
                const edgeStartIndex = ctx.thread.query.index;
                try Include.include(edge, ctx, edgeQuery, edgeTypeEntry);
                ctx.thread.query.writeAs(
                    u32,
                    @truncate(ctx.thread.query.index - edgeStartIndex),
                    edgesByteSizeIndex,
                );
            }

            i.* += header.edgeSize + header.includeSize;

            ctx.thread.query.writeAs(
                u32,
                @truncate(ctx.thread.query.index - startIndex),
                resultByteSizeIndex,
            );
        }
    }

    i.* += header.includeSize;
}
