const QueryCtx = @import("../types.zig").QueryCtx;
const getSingleRefFields = @import("./reference.zig").getSingleRefFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const read = @import("../../utils.zig").read;
const db = @import("../../db//db.zig");
const getRefsFields = @import("./references/references.zig").getRefsFields;
const aggregateRefsFields = @import("../aggregate/references.zig").aggregateRefsFields;
const types = @import("./types.zig");
const t = @import("../../types.zig");
const f = @import("./field.zig");
const results = @import("../results.zig");

const std = @import("std");

pub fn getFields(
    node: db.Node,
    ctx: *QueryCtx,
    id: u32,
    typeEntry: db.Type,
    include: []u8,
    edgeRef: ?types.RefStruct,
    score: ?[4]u8,
    comptime isEdge: bool,
) !usize {
    var size: usize = 0;
    var i: u16 = 0;
    var idIsSet: bool = isEdge;

    while (i < include.len) {
        const op: t.IncludeOp = @enumFromInt(include[i]);
        i += 1;
        switch (op) {
            t.IncludeOp.edge => {
                const edgeSize = read(u16, include, i);
                i += 2;
                const operation = include[i .. i + edgeSize];
                if (!idIsSet) {
                    idIsSet = true;
                    size += try addIdOnly(ctx, id, score);
                }
                size += try getFields(node, ctx, id, typeEntry, operation, .{
                    .reference = edgeRef.?.reference,
                    .edgeConstaint = edgeRef.?.edgeConstaint,
                    .edgeReference = null,
                }, null, true);
                i += edgeSize + 2;
            },
            t.IncludeOp.references => {
                const operation = include[i..];
                const refSize = read(u16, operation, 0);
                const multiRefs = operation[2 .. 2 + refSize];
                i += refSize + 2;
                if (!idIsSet) {
                    idIsSet = true;
                    size += try addIdOnly(ctx, id, score);
                }
                size += getRefsFields(ctx, multiRefs, node, typeEntry, edgeRef, isEdge);
            },
            t.IncludeOp.reference => {
                const operation = include[i..];
                const refSize = read(u16, operation, 0);
                const singleRef = operation[2 .. 2 + refSize];
                i += refSize + 2;
                if (!idIsSet) {
                    idIsSet = true;
                    size += try addIdOnly(ctx, id, score);
                }
                size += getSingleRefFields(ctx, singleRef, node, typeEntry, edgeRef, isEdge);
            },
            t.IncludeOp.referencesAggregation => {
                const operation = include[i..];
                const refSize = read(u16, operation, 0);
                const multiRefs = operation[2 .. 2 + refSize];
                i += refSize + 2;
                if (!idIsSet) {
                    idIsSet = true;
                    size += try addIdOnly(ctx, id, score);
                }
                size += try aggregateRefsFields(ctx, multiRefs, node, typeEntry, isEdge);
                return size;
            },
            t.IncludeOp.partial => {
                var result: ?*results.Result = null;
                const field: u8 = include[i];
                const prop: t.Prop = @enumFromInt(include[i + 1]);
                i += 2;
                result = try f.get(ctx, id, node, field, prop, typeEntry, edgeRef, isEdge, f.ResultType.fixed);
                const includeSize = read(u16, include, i);
                i += 2 + includeSize;
                if (result) |r| {
                    size += try f.partial(ctx, r, include[i - includeSize .. i], isEdge);
                    size += try f.add(ctx, id, score, idIsSet, r);
                    idIsSet = true;
                }
            },
            t.IncludeOp.meta => {
                var result: ?*results.Result = null;
                const field: u8 = include[i];
                const prop: t.Prop = @enumFromInt(include[i + 1]);
                const langCode: t.LangCode = @enumFromInt(include[i + 2]);
                i += 3;
                result = try f.get(ctx, id, node, field, prop, typeEntry, edgeRef, isEdge, f.ResultType.meta);
                if (result) |r| {
                    switch (prop) {
                        t.Prop.BINARY, t.Prop.STRING, t.Prop.JSON, t.Prop.ALIAS => {
                            if (isEdge) {
                                size += 1;
                            }
                            size += 12 + try f.add(ctx, id, score, idIsSet, r);
                            idIsSet = true;
                        },
                        t.Prop.TEXT => {
                            if (isEdge) {
                                size += 1;
                            }
                            const s = db.getTextFromValue(r.*.value, langCode);
                            if (s.len != 0) {
                                r.*.value = s;
                                size += 12 + try f.add(ctx, id, score, idIsSet, r);
                                idIsSet = true;
                            }
                        },
                        else => {},
                    }
                }
            },
            t.IncludeOp.default => {
                var result: ?*results.Result = null;
                const field: u8 = include[i];
                const prop: t.Prop = @enumFromInt(include[i + 1]);
                // here we add a start + end var (bit longer but fine)
                i += 2;
                result = try f.get(ctx, id, node, field, prop, typeEntry, edgeRef, isEdge, f.ResultType.default);
                if (result) |r| {
                    switch (prop) {
                        t.Prop.BINARY,
                        t.Prop.STRING,
                        t.Prop.JSON,
                        => {
                            size += try f.selvaString(r, isEdge);
                            size += try f.add(ctx, id, score, idIsSet, r);
                            idIsSet = true;
                        },
                        t.Prop.TEXT => {
                            const code: t.LangCode = @enumFromInt(include[i]);
                            const fallbackSize = include[i + 1];
                            i += 2;
                            if (fallbackSize > 0) {
                                const fb = include[i .. i + fallbackSize];
                                const s = try f.textFallback(isEdge, ctx, id, score, r, code, idIsSet, fb);
                                if (s != 0) {
                                    idIsSet = true;
                                    size += s;
                                }
                                i += fallbackSize;
                            } else if (code == t.LangCode.NONE) {
                                size += try f.textAll(isEdge, ctx, id, score, r, idIsSet);
                                idIsSet = true;
                            } else {
                                const s = try f.textSpecific(isEdge, ctx, id, score, r, code, idIsSet);
                                if (s != 0) {
                                    idIsSet = true;
                                    size += s;
                                }
                            }
                        },
                        t.Prop.MICRO_BUFFER, t.Prop.VECTOR => {
                            size += try f.fixed(r, isEdge);
                            size += try f.add(ctx, id, score, idIsSet, r);
                            idIsSet = true;
                        },
                        else => {
                            size += try f.default(r, isEdge);
                            size += try f.add(ctx, id, score, idIsSet, r);
                            idIsSet = true;
                        },
                    }
                } else {
                    if (prop == t.Prop.TEXT) {
                        const fallbackSize = include[i + 1];
                        i += 2;
                        i += fallbackSize;
                    }
                }
            },
        }
    }

    if (!idIsSet) {
        idIsSet = true;
        size += try addIdOnly(ctx, id, score);
    }

    return size;
}
