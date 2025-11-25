const std = @import("std");
const Query = @import("common.zig");
const utils = @import("../utils.zig");
const Node = @import("../selva/node.zig");
const Thread = @import("../thread/thread.zig");
const Schema = @import("../selva/schema.zig");
const Fields = @import("../selva/fields.zig");
const opts = @import("./opts.zig");
const t = @import("../types.zig");

pub inline fn appendInclude(thread: *Thread.Thread, prop: u8, value: []u8) !void {
    if (value.len == 0) {
        return;
    }
    const header: t.IncludeResponse = .{
        .prop = prop,
        .size = @truncate(value.len),
    };
    const headerSize = utils.sizeOf(t.IncludeResponse);
    const newSlice = try thread.query.slice(headerSize + value.len);
    utils.write(newSlice, header, 0);
    utils.write(newSlice, value, headerSize);
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

        std.debug.print(" include -> {any} \n", .{op});

        // i += 1;
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
                //             }
                //         },
                //         else => {},
                //     }
                // }
            },
            t.IncludeOp.default => {
                const header = utils.readNext(t.IncludeHeader, q, &i);
                const fieldSchema = try Schema.getFieldSchema(typeEntry, header.prop);
                const value = Fields.getField(typeEntry, node, fieldSchema, header.propType);

                if (header.hasOpts) {
                    const optsHeader = utils.readNext(t.IncludeOptsHeader, q, &i);
                    switch (header.propType) {
                        t.PropType.binary,
                        t.PropType.string,
                        t.PropType.json,
                        => {
                            try appendInclude(ctx.thread, header.prop, opts.parse(value, &optsHeader));
                        },
                        else => {
                            // more
                        },
                    }
                } else {
                    switch (header.propType) {
                        t.PropType.text,
                        => {},
                        t.PropType.binary, t.PropType.string, t.PropType.json => {
                            try appendInclude(ctx.thread, header.prop, value[0 .. value.len - 4]);
                        },
                        else => {
                            try appendInclude(ctx.thread, header.prop, value);
                        },
                    }
                }

                //         var result: ?*results.Result = null;
                //         const field: u8 = include[i];
                //         const prop: t.PropType = @enumFromInt(include[i + 1]);
                //         const optsSize = include[i + 2];
                //         i += 3;
                //         result = try f.get(ctx, node, field, prop, typeEntry, edgeRef, isEdge, f.ResultType.default);
                //         if (result) |r| {
                //             switch (prop) {
                //                 t.PropType.binary,
                //                 t.PropType.string,
                //                 t.PropType.json,
                //                 => {
                //                     if (optsSize != 0) {
                //                         size += try f.selvaString(ctx, isEdge, r, true, o.getOpts(include, &i));
                //                         i += optsSize;
                //                     } else {
                //                         size += try f.selvaString(ctx, isEdge, r, false, undefined);
                //                     }
                //                     size += try f.add(ctx, id, score, idIsSet, r);
                //                     idIsSet = true;
                //                 },
                //                 t.PropType.text => {
                //                     var s: usize = undefined;
                //                     if (optsSize == 0) {
                //                         s = try f.textAll(isEdge, ctx, id, score, r, idIsSet, false, undefined);
                //                     } else {
                //                         const code: t.LangCode = @enumFromInt(include[i]);
                //                         const fallbackSize = include[i + 1];
                //                         const hasEnd = include[i + 2] == 1;
                //                         if (hasEnd) {
                //                             i += optsSize - 5;
                //                             const opts = o.getOpts(include, &i);
                //                             i += 5;
                //                             s = try f.switchText(isEdge, code, ctx, id, score, fallbackSize, include, &i, r, idIsSet, true, opts);
                //                         } else {
                //                             i += optsSize;
                //                             s = try f.switchText(isEdge, code, ctx, id, score, fallbackSize, include, &i, r, idIsSet, false, undefined);
                //                         }
                //                     }
                //                     if (s != 0) {
                //                         idIsSet = true;
                //                         size += s;
                //                     }
                //                 },
                //                 t.PropType.microBuffer, t.PropType.vector, t.PropType.colVec => {
                //                     if (optsSize == 0) {
                //                         size += try f.fixed(isEdge, r, false, undefined);
                //                     } else {
                //                         size += try f.fixed(isEdge, r, true, o.getOpts(include, &i));
                //                         i += optsSize;
                //                     }
                //                     size += try f.add(ctx, id, score, idIsSet, r);
                //                     idIsSet = true;
                //                 },
                //                 else => {
                //                     if (optsSize == 0) {
                //                         size += try f.default(isEdge, r, false, undefined);
                //                     } else {
                //                         size += try f.default(isEdge, r, true, o.getOpts(include, &i));
                //                         i += optsSize;
                //                     }
                //                     size += try f.add(ctx, id, score, idIsSet, r);
                //                     idIsSet = true;
                //                 },
                //             }
                //         } else if (optsSize != 0) {
                //             i += optsSize;
                //         }
            },
            else => {
                //
            },
        }
    }
}
