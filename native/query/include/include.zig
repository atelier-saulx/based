const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Thread = @import("../../thread/thread.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const opts = @import("./opts.zig");
const append = @import("./append.zig");
const t = @import("../../types.zig");
const multiple = @import("../multiple.zig");
const single = @import("../single.zig");
const References = @import("../../selva/references.zig");

inline fn get(typeEntry: Node.Type, node: Node.Node, header: anytype) ![]u8 {
    return Fields.get(
        typeEntry,
        node,
        try Schema.getFieldSchema(typeEntry, header.prop),
        header.propType,
    );
}

pub fn recursionErrorBoundary(
    cb: anytype,
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
    index: *usize,
) void {
    cb(ctx, q, node, typeEntry, index) catch |err| {
        std.debug.print("recursionErrorBoundary: Error {any} \n", .{err});
    };
}

pub inline fn include(
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !void {
    // comptime {
    //     // This funciton has a lot of recursion so you need to increase the allowed branch eval amount
    //     @setEvalBranchQuota(1000);
    // }

    var i: usize = 0;
    while (i < q.len) {
        const op: t.IncludeOp = @enumFromInt(q[i]);

        switch (op) {
            // add .referenceEdge?
            .reference => {
                recursionErrorBoundary(single.reference, node, ctx, q, typeEntry, &i);
            },
            .referenceEdge => {
                recursionErrorBoundary(single.referenceEdge, node, ctx, q, typeEntry, &i);
            },
            .references => {
                recursionErrorBoundary(multiple.references, node, ctx, q, typeEntry, &i);
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
                const header = utils.readNext(t.IncludeMetaHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                switch (header.propType) {
                    t.PropType.binary, t.PropType.string, t.PropType.json, t.PropType.alias => {
                        try append.meta(ctx.thread, header.prop, value);
                    },
                    t.PropType.text => {
                        var iter = Fields.textIterator(value);
                        while (iter.next()) |textValue| {
                            try append.meta(ctx.thread, header.prop, textValue);
                        }
                    },
                    else => {
                        // No usefull metainfo for non-selvaString props yet
                    },
                }
            },
            .metaWithOpts => {
                var header = utils.readNext(t.IncludeMetaHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                switch (header.propType) {
                    t.PropType.text => {
                        var optsHeader = utils.readNext(t.IncludeOpts, q, &i);
                        try opts.text(ctx.thread, header.prop, value, q, &i, &optsHeader, opts.meta);
                    },
                    else => {},
                }
            },
            .defaultWithOpts => {
                const header = utils.readNext(t.IncludeHeader, q, &i);
                const value = try get(typeEntry, node, &header);
                var optsHeader = utils.readNext(t.IncludeOpts, q, &i);
                switch (header.propType) {
                    t.PropType.binary, t.PropType.string, t.PropType.json => {
                        try opts.string(ctx.thread, header.prop, value, &optsHeader);
                    },
                    t.PropType.text,
                    => {
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
                    t.PropType.text,
                    => {
                        var iter = Fields.textIterator(value);
                        while (iter.next()) |textValue| {
                            try append.stripCrc32(ctx.thread, header.prop, textValue);
                        }
                    },
                    t.PropType.binary, t.PropType.string, t.PropType.json => {
                        // utils.printString("derp", value);
                        try append.stripCrc32(ctx.thread, header.prop, value);
                    },
                    t.PropType.microBuffer, t.PropType.vector, t.PropType.colVec => {
                        // Fixed size
                        try ctx.thread.query.append(header.prop);
                        try ctx.thread.query.append(value);
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
                std.debug.print("AGG refs not implemented yet\n", .{});
                i += 1;
            },
        }
    }
}
