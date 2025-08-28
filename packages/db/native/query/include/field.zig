const types = @import("./types.zig");
const std = @import("std");
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const t = @import("../../types.zig");
const selva = @import("../../selva.zig");
const results = @import("../results.zig");
const errors = @import("../../errors.zig");
const utils = @import("../../utils.zig");
const decompressFirstBytes = @import("../../db/decompress.zig").decompressFirstBytes;
const o = @import("./opts.zig");

pub const ResultType = enum(u8) {
    default = 0,
    meta = 7,
    fixed = 9,
};

pub inline fn get(
    ctx: *QueryCtx,
    id: u32,
    node: db.Node,
    field: u8,
    prop: t.Prop,
    typeEntry: db.Type,
    edgeRef: ?types.RefStruct,
    comptime isEdge: bool,
    comptime subType: ResultType,
) !?*results.Result {
    var value: []u8 = undefined;
    var fieldSchema: *const selva.SelvaFieldSchema = undefined;
    var result: results.Result = undefined;
    if (isEdge) {
        if (edgeRef.?.edgeConstraint == null) {
            return errors.DbIncludeError.EDGE_FROM_WEAKREF;
        }
        fieldSchema = try db.getEdgeFieldSchema(ctx.db, edgeRef.?.edgeConstraint.?, field);
        if (prop == t.Prop.CARDINALITY) {
            // make this in getEdgeProp
            value = db.getCardinalityReference(ctx.db, edgeRef.?.largeReference.?, fieldSchema);
        } else {
            value = db.getEdgeProp(edgeRef.?.largeReference.?, fieldSchema);
        }
        if (value.len == 0) {
            return null;
        }
        result = .{
            .type = if (subType == ResultType.meta) t.ResultType.metaEdge else if (subType == ResultType.fixed) t.ResultType.edgeFixed else t.ResultType.edge,
            .id = 0,
            .score = null,
            .prop = field,
            .value = value,
        };
    } else {
        fieldSchema = try db.getFieldSchema(typeEntry, field);
        value = db.getField(typeEntry, id, node, fieldSchema, prop);
        if (value.len == 0) {
            return null;
        }
        result = .{
            .type = if (subType == ResultType.meta) t.ResultType.meta else if (subType == ResultType.fixed) t.ResultType.fixed else t.ResultType.default,
            .id = 0,
            .score = null,
            .prop = field,
            .value = value,
        };
    }
    return &result;
}

pub fn add(
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
    idIsSet: bool,
    result: *results.Result,
) !usize {
    var size: usize = 0;
    if (!idIsSet) {
        size += 5;
        result.*.id = id;
        if (score != null) {
            result.*.score = score;
            size += 4;
        }
    }
    try ctx.results.append(result.*);
    return size;
}

pub inline fn partial(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    result: *results.Result,
    includeMain: []u8,
) !usize {
    const original = result.*.value;
    const size = utils.read(u16, includeMain, 0);
    const value = try ctx.allocator.alloc(u8, size);
    var mainPos: usize = 2;
    var j: usize = 0;
    while (mainPos < includeMain.len) {
        const mainOp = includeMain[mainPos..];
        const start = utils.read(u16, mainOp, 0);
        const len = utils.read(u16, mainOp, 2);
        utils.copy(value[j .. j + len], original[start .. start + len]);
        j += len;
        mainPos += 4;
    }
    result.*.value = value;
    if (isEdge) {
        return size + 2;
    } else {
        return size + 1;
    }
}

// ==============================================

pub inline fn default(
    comptime isEdge: bool,
    result: *results.Result,
    comptime hasOpts: bool,
    opts: if (hasOpts) *const o.IncludeOpts else void,
) !usize {
    if (hasOpts) {
        result.*.value = o.parseOpts(result.*.value, opts);
    }
    if (isEdge) {
        return result.value.len + 6;
    } else {
        return result.value.len + 5;
    }
}

pub inline fn fixed(
    comptime isEdge: bool,
    result: *results.Result,
    comptime hasOpts: bool,
    opts: if (hasOpts) *const o.IncludeOpts else void,
) !usize {
    if (hasOpts) {
        result.*.value = o.parseOpts(result.value, opts);
    }
    if (isEdge) {
        result.*.type = t.ResultType.edgeFixed;
        return result.value.len + 2;
    } else {
        result.*.type = t.ResultType.fixed;
        return result.value.len + 1;
    }
}

pub inline fn selvaString(
    ctx: *QueryCtx,
    comptime isEdge: bool,
    r: *results.Result,
    comptime hasOpts: bool,
    opts: if (hasOpts) *const o.IncludeOpts else void,
) !usize {
    if (hasOpts) {
        r.*.value = try o.parseOptsString(ctx, r.value, opts);
    } else {
        r.*.value = r.value[0 .. r.value.len - 4];
    }
    return r.value.len + (if (isEdge) 6 else 5);
}

pub inline fn switchText(
    comptime isEdge: bool,
    code: t.LangCode,
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
    fallbackSize: u8,
    include: []u8,
    i: *u16,
    r: *results.Result,
    idIsSet: bool,
    comptime hasOpts: bool,
    opts: if (hasOpts) *const o.IncludeOpts else void,
) !usize {
    if (hasOpts) {
        if (code == t.LangCode.NONE) {
            return try textAll(isEdge, ctx, id, score, r, idIsSet, true, opts);
        } else if (fallbackSize > 0) {
            const fb = include[i.* - fallbackSize .. i.*];
            return try textFallback(isEdge, ctx, id, score, r, code, idIsSet, fb, true, opts);
        } else {
            return try textSpecific(isEdge, ctx, id, score, r, code, idIsSet, true, opts);
        }
    } else {
        if (code == t.LangCode.NONE) {
            return try textAll(isEdge, ctx, id, score, r, idIsSet, false, undefined);
        } else if (fallbackSize > 0) {
            const fb = include[i.* - fallbackSize .. i.*];
            return try textFallback(isEdge, ctx, id, score, r, code, idIsSet, fb, false, undefined);
        } else {
            return try textSpecific(isEdge, ctx, id, score, r, code, idIsSet, false, undefined);
        }
    }
}

pub inline fn textSpecific(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
    result: *results.Result,
    code: t.LangCode,
    idIsSet: bool,
    comptime hasOpts: bool,
    opts: if (hasOpts) *const o.IncludeOpts else void,
) !usize {
    var idIsSetLocal: bool = idIsSet;
    var size: usize = 0;
    const s = if (hasOpts)
        try o.parseOptsString(ctx, db.getTextFromValue(result.value, code), opts)
    else
        db.getTextFromValue(result.value, code);
    if (s.len > 0) {
        var r: results.Result = .{
            .type = result.type,
            .id = 0,
            .score = null,
            .prop = result.prop,
            .value = if (hasOpts) s else s[0 .. s.len - 4],
        };
        if (isEdge) size += (r.value.len + 6) else size += (r.value.len + 5);
        size += try add(ctx, id, score, idIsSetLocal, &r);
        idIsSetLocal = true;
    }
    return size;
}

pub inline fn textFallback(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
    result: *results.Result,
    code: t.LangCode,
    idIsSet: bool,
    fallbacks: []u8,
    comptime hasOpts: bool,
    opts: if (hasOpts) *const o.IncludeOpts else void,
) !usize {
    var idIsSetLocal: bool = idIsSet;
    var size: usize = 0;
    const s = if (hasOpts)
        try o.parseOptsString(ctx, db.getTextFromValueFallback(result.value, code, fallbacks), opts)
    else
        db.getTextFromValueFallback(result.value, code, fallbacks);
    if (s.len > 0) {
        var r: results.Result = .{
            .type = result.type,
            .id = 0,
            .score = null,
            .prop = result.prop,
            .value = if (hasOpts) s else s[0 .. s.len - 4],
        };
        if (isEdge) size += (r.value.len + 6) else size += (r.value.len + 5);
        size += try add(ctx, id, score, idIsSetLocal, &r);
        idIsSetLocal = true;
    }
    return size;
}

pub inline fn textAll(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
    result: *results.Result,
    idIsSet: bool,
    comptime hasOpts: bool,
    opts: if (hasOpts) *const o.IncludeOpts else void,
) !usize {
    var idIsSetLocal: bool = idIsSet;
    var size: usize = 0;
    var iter = db.textIterator(result.*.value);
    while (iter.next()) |s| {
        var r: results.Result = undefined;
        r = .{
            .type = result.type,
            .id = 0,
            .score = null,
            .prop = result.prop,
            .value = if (hasOpts) try o.parseOptsString(ctx, s, opts) else s[0 .. s.len - 4],
        };
        if (isEdge) size += (r.value.len + 6) else size += (r.value.len + 5);
        size += try add(ctx, id, score, idIsSetLocal, &r);
        idIsSetLocal = true;
    }
    return size;
}
