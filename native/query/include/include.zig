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
            // t.IncludeOp.references => {
            // call multiple
            //     const operation = include[i..];
            //     const refSize = read(u16, operation, 0);
            //     const multiRefs = operation[2 .. 2 + refSize];
            //     i += refSize + 2;
            //     if (!idIsSet) {
            //         idIsSet = true;
            //         size += try addIdOnly(ctx, id, score);
            //     }
            //     size += getRefsFields(ctx, multiRefs, node, typeEntry, edgeRef, isEdge);
            // },
            // t.IncludeOp.reference => {
            //  call single
            //     const operation = include[i..];
            //     const refSize = read(u16, operation, 0);
            //     const singleRef = operation[2 .. 2 + refSize];
            //     i += refSize + 2;
            //     if (!idIsSet) {
            //         idIsSet = true;
            //         size += try addIdOnly(ctx, id, score);
            //     }
            //     size += getSingleRefFields(ctx, singleRef, node, typeEntry, edgeRef, isEdge);
            // },
            // t.IncludeOp.referencesAggregation => {
            //     const operation = include[i..];
            //     const refSize = read(u16, operation, 0);
            //     const multiRefs = operation[2 .. 2 + refSize];
            //     i += refSize + 2;
            //     if (!idIsSet) {
            //         idIsSet = true;
            //         size += try addIdOnly(ctx, id, score);
            //     }
            //     size += try aggregateRefsFields(ctx, multiRefs, node, typeEntry);
            //     return size;
            // },
            t.IncludeOp.partial => {
                // var result: ?*results.Result = null;
                // const field: u8 = include[i];
                // const prop: t.PropType = @enumFromInt(include[i + 1]);
                // i += 2;
                // result = try f.get(ctx, node, field, prop, typeEntry, edgeRef, isEdge, f.ResultType.fixed);
                // const includeSize = read(u16, include, i);
                // i += 2 + includeSize;
                // if (result) |r| {
                //     size += try f.partial(isEdge, ctx, r, include[i - includeSize .. i]);
                //     size += try f.add(ctx, id, score, idIsSet, r);
                //     idIsSet = true;
                // }
            },
            t.IncludeOp.meta => {
                // var result: ?*results.Result = null;
                // const field: u8 = include[i];
                // const prop: t.PropType = @enumFromInt(include[i + 1]);
                // const langCode: t.LangCode = @enumFromInt(include[i + 2]);
                // i += 3;
                // result = try f.get(ctx, node, field, prop, typeEntry, edgeRef, isEdge, f.ResultType.meta);
                // if (result) |r| {
                //     switch (prop) {
                //         t.PropType.binary, t.PropType.string, t.PropType.json, t.PropType.alias => {
                //             if (isEdge) {
                //                 size += 1;
                //             }
                //             size += 12 + try f.add(ctx, id, score, idIsSet, r);
                //             idIsSet = true;
                //         },
                //         t.PropType.text => {
                //             if (isEdge) {
                //                 size += 1;
                //             }
                //             const s = db.getTextFromValue(r.*.value, langCode);
                //             if (s.len != 0) {
                //                 r.*.value = s;
                //                 size += 12 + try f.add(ctx, id, score, idIsSet, r);
                //                 idIsSet = true;
                //             }§
                //         },
                //         else => {},
                //     }
                // }
            },
            t.IncludeOp.defaultWithOpts => {
                const header = utils.readNext(t.IncludeHeader, q, &i);
                const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
                const value = Fields.get(typeEntry, node, fieldSchema, header.propType);
                var optsHeader = utils.readNext(t.IncludeOpts, q, &i);
                switch (header.propType) {
                    t.PropType.binary,
                    t.PropType.string,
                    t.PropType.json,
                    => {
                        try opts.string(ctx.thread, header.prop, value, &optsHeader);
                    },
                    t.PropType.text,
                    => {
                        if (optsHeader.lang == t.LangCode.none) {
                            var iter = Fields.textIterator(value);
                            while (iter.next()) |textValue| {
                                try opts.string(ctx.thread, header.prop, textValue, &optsHeader);
                            }
                        } else if (optsHeader.next) {
                            while (optsHeader.next) {
                                try opts.string(ctx.thread, header.prop, Fields.textFromValue(value, optsHeader.lang), &optsHeader);
                                optsHeader = utils.readNext(t.IncludeOpts, q, &i);
                            }
                        } else if (optsHeader.langFallbackSize > 0) {
                            try opts.string(
                                ctx.thread,
                                header.prop,
                                Fields.textFromValueFallback(
                                    value,
                                    optsHeader.lang,
                                    utils.sliceNext(optsHeader.langFallbackSize, q, &i),
                                ),
                                &optsHeader,
                            );
                        } else {
                            try opts.string(ctx.thread, header.prop, Fields.textFromValue(value, optsHeader.lang), &optsHeader);
                        }
                    },
                    else => {
                        try append.default(ctx.thread, header.prop, opts.parse(value, &optsHeader));
                    },
                }
            },
            t.IncludeOp.default => {
                const header = utils.readNext(t.IncludeHeader, q, &i);
                const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
                const value = Fields.get(typeEntry, node, fieldSchema, header.propType);
                switch (header.propType) {
                    t.PropType.text,
                    => {
                        var iter = Fields.textIterator(value);
                        while (iter.next()) |textValue| {
                            try append.stripCrc32(ctx.thread, header.prop, textValue);
                        }
                    },
                    t.PropType.binary, t.PropType.string, t.PropType.json => {
                        try append.stripCrc32(ctx.thread, header.prop, value);
                    },
                    else => {
                        try append.default(ctx.thread, header.prop, value);
                    },
                }
            },
            else => {
                //
            },
        }
    }
}
