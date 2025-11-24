const std = @import("std");
const Query = @import("./common.zig");
const utils = @import("../utils.zig");
const db = @import("../selva/db.zig");
const Node = @import("../selva/node.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
// const f = @import("./prop.zig");
// const o = @import("./opts.zig");

// call this include
pub fn include(
    _: Node.Node,
    _: *Query.QueryCtx, // prob just want to pass type entry on the queryctx..
    q: []u8, // call this q
    // size:
    // id: u32,
    // parentRef: ?Query.RefStruct,
    // this is then the only thing but also not nessecary
    // edges just need to handle in reference and references as a second argument there
    // score: ?[4]u8, // think about it
) !void {
    // var size: usize = 0;
    var i: u16 = 0;
    // var idIsSet: bool = false;

    // here it will write the id

    // std.debug.print(" include -> {any} \n", .{node});

    while (i < q.len) {
        const op: t.IncludeOp = @enumFromInt(q[i]);
        i += 1;
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

    // if (!idIsSet) {
    //     idIsSet = true;
    //     size += try addIdOnly(ctx, id, score);
    // }

    // return size;
}
