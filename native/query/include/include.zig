const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Thread = @import("../../thread/thread.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const opts = @import("opts.zig");
const append = @import("append.zig");
const t = @import("../../types.zig");
const Multiple = @import("../multiple/references.zig");
const Single = @import("../single.zig");
const References = @import("../../selva/references.zig");
const aggregateRefs = @import("../aggregates/references.zig");

inline fn get(typeEntry: Node.Type, node: Node.Node, header: anytype) ![]u8 {
    return Fields.get(
        typeEntry,
        node,
        try Schema.getFieldSchema(typeEntry, header.prop),
        header.propType,
    );
}

pub fn recursionErrorBoundarySingleRef(
    cb: anytype,
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
    index: *usize,
) void {
    cb(ctx, q, node, typeEntry, index) catch |err| {
        std.debug.print("Include Reference: recursionErrorBoundary: Error {any} \n", .{err});
    };
}

pub fn recursionErrorBoundaryRefs(
    cb: anytype,
    comptime edge: Multiple.EdgeType,
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
    index: *usize,
) void {
    cb(edge, ctx, q, node, typeEntry, index) catch |err| {
        std.debug.print("Include References: recursionErrorBoundary: Error {any} \n", .{err});
    };
}

pub fn include(
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !void {
    var i: usize = 0;
    while (i < q.len) {
        const op: t.IncludeOp = @enumFromInt(q[i]);
        switch (op) {
            .reference => {
                recursionErrorBoundarySingleRef(Single.reference, node, ctx, q, typeEntry, &i);
            },
            .referenceEdge => {
                recursionErrorBoundarySingleRef(Single.referenceEdge, node, ctx, q, typeEntry, &i);
            },
            .references => {
                recursionErrorBoundaryRefs(Multiple.references, .noEdge, node, ctx, q, typeEntry, &i);
            },
            .referencesEdge => {
                recursionErrorBoundaryRefs(Multiple.references, .edge, node, ctx, q, typeEntry, &i);
            },
            .referencesEdgeInclude => {
                recursionErrorBoundaryRefs(Multiple.references, .includeEdge, node, ctx, q, typeEntry, &i);
            },
            .partial => {
                const header = utils.readNext(t.IncludePartialHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                try ctx.thread.query.append(header.prop);
                var it = utils.readIterator(t.IncludePartialProp, q, header.amount, &i);
                while (it.next()) |p| {
                    try ctx.thread.query.append(value[p.start .. p.start + p.size]);
                }
            },
            .meta => {
                // just make this into include
                const header = utils.readNext(t.IncludeHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                switch (header.propType) {
                    .binary, .string, .json, .alias => {
                        try append.meta(ctx.thread, header.prop, value);
                    },
                    .stringLocalized, .jsonLocalized => {
                        var iter = Fields.textIterator(value);
                        while (iter.next()) |textValue| {
                            try append.meta(ctx.thread, header.prop, textValue);
                        }
                    },
                    else => {
                        // No useful metainfo for non-selvaString props yet
                    },
                }
            },
            .metaWithOpts => {
                var header = utils.readNext(t.IncludeHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                switch (header.propType) {
                    .stringLocalized, .jsonLocalized => {
                        var optsHeader = utils.readNext(t.IncludeOpts, q, &i);
                        try opts.text(ctx.thread, header.prop, value, q, &i, &optsHeader, opts.meta);
                    },
                    else => {
                        // Only for fallbacks and single lang
                    },
                }
            },
            .defaultWithOpts => {
                const header = utils.readNext(t.IncludeHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                var optsHeader = utils.readNext(t.IncludeOpts, q, &i);
                switch (header.propType) {
                    .binary, .string, .json => {
                        try opts.string(ctx.thread, header.prop, value, &optsHeader);
                    },
                    .stringLocalized, .jsonLocalized => {
                        try opts.text(ctx.thread, header.prop, value, q, &i, &optsHeader, opts.string);
                    },
                    else => {
                        try append.default(ctx.thread, header.prop, opts.parse(value, &optsHeader));
                    },
                }
            },
            .default => {
                const header = utils.readNext(t.IncludeHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                switch (header.propType) {
                    .stringLocalized, .jsonLocalized => {
                        var iter = Fields.textIterator(value);
                        while (iter.next()) |textValue| {
                            try append.stripCrc32(ctx.thread, header.prop, textValue);
                        }
                    },
                    .binary, .string, .json => {
                        try append.stripCrc32(ctx.thread, header.prop, value);
                    },
                    .microBuffer, .vector, .colVec => {
                        // Fixed size
                        try ctx.thread.query.append(header.prop);
                        if (value.len == 0) {
                            const fs = try Schema.getFieldSchema(typeEntry, header.prop);
                            _ = try ctx.thread.query.reserve(fs.unnamed_0.smb.len);
                        } else {
                            try ctx.thread.query.append(value);
                        }
                    },
                    else => {
                        try append.default(ctx.thread, header.prop, value);
                    },
                }
            },
            .aggregates => {
                std.debug.print("AGG not implemented yet\n", .{});
                i += 1;
            },
            .aggregatesCount => {
                std.debug.print("AGG count not implemented yet\n", .{});
                i += 1;
            },
            .referencesAggregation => {
                try aggregateRefs.aggregateRefsProps(ctx, q, node, typeEntry, &i);
            },
        }
    }
}
