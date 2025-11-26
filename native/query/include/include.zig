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

            //     fn addChecksum(item: *Result, data: []u8, i: *usize) void {
            //     data[i.*] = @intFromEnum(t.ReadOp.META);
            //     i.* += 1;
            //     data[i.*] = item.*.prop;
            //     i.* += 1;
            //     const v = item.*.value;
            //     data[i.*] = v[0];
            //     i.* += 1;
            //     data[i.*] = v[1];
            //     i.* += 1;
            //     utils.copy(data[i.* .. i.* + 4], v[v.len - 4 .. v.len]);
            //     if (v[1] == 1) {
            //         utils.copy(data[i.* + 4 .. i.* + 8], v[2..6]);
            //     } else {
            //         writeInt(u32, data, i.* + 4, v.len);
            //     }
            //     i.* += 8;
            // }

            t.IncludeOp.meta => {
                const header = utils.readNext(t.IncludeMetaHeader, q, &i);
                const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
                const value = Fields.get(typeEntry, node, fieldSchema, header.propType);
                // var v: []u8 = value;
                switch (header.propType) {
                    t.PropType.binary, t.PropType.string, t.PropType.json, t.PropType.alias => {
                        if (value.len > 0) {
                            _ = try ctx.thread.query.appendAs(t.IncludeResponseMeta, .{
                                .op = t.ReadOp.meta,
                                .prop = header.prop,
                                .lang = @enumFromInt(value[0]),
                                .compressed = value[1],
                                .crc32 = utils.read(u32, value, value.len - 4),
                                .size = if (value[1] == 1) utils.read(u32, value, 2) else @truncate(value.len - 6),
                            });
                        }
                    },
                    t.PropType.text => {
                        const s = Fields.textFromValue(value, header.lang);
                        if (s.len > 0) {
                            _ = try ctx.thread.query.appendAs(t.IncludeResponseMeta, .{
                                .op = t.ReadOp.meta,
                                .prop = header.prop,
                                .lang = header.lang,
                                .compressed = s[1],
                                .crc32 = utils.read(u32, s, s.len - 4),
                                .size = if (s[1] == 1) utils.read(u32, s, 2) else @truncate(s.len - 6),
                            });
                        }
                    },
                    else => {},
                }
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
                        switch (optsHeader.langFallbackSize) {
                            0 => {
                                if (optsHeader.lang == t.LangCode.none) {
                                    var iter = Fields.textIterator(value);
                                    while (iter.next()) |textValue| {
                                        try opts.string(ctx.thread, header.prop, textValue, &optsHeader);
                                    }
                                } else if (optsHeader.next) {
                                    while (optsHeader.next) {
                                        try opts.string(
                                            ctx.thread,
                                            header.prop,
                                            Fields.textFromValue(value, optsHeader.lang),
                                            &optsHeader,
                                        );
                                        optsHeader = utils.readNext(t.IncludeOpts, q, &i);
                                    }
                                } else {
                                    try opts.string(
                                        ctx.thread,
                                        header.prop,
                                        Fields.textFromValue(value, optsHeader.lang),
                                        &optsHeader,
                                    );
                                }
                            },
                            1 => {
                                try opts.string(
                                    ctx.thread,
                                    header.prop,
                                    Fields.textFromValueFallback(value, optsHeader.lang, utils.readNext(t.LangCode, q, &i)),
                                    &optsHeader,
                                );
                            },
                            else => {
                                try opts.string(
                                    ctx.thread,
                                    header.prop,
                                    Fields.textFromValueFallbacks(
                                        value,
                                        optsHeader.lang,
                                        utils.sliceNextAs(t.LangCode, optsHeader.langFallbackSize, q, &i),
                                    ),
                                    &optsHeader,
                                );
                            },
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
