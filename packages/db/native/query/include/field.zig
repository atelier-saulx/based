const types = @import("./types.zig");
const std = @import("std");
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const t = @import("../../types.zig");
const selva = @import("../../selva.zig");
const results = @import("../results.zig");
const errors = @import("../../errors.zig");
const utils = @import("../../utils.zig");

pub inline fn get(
    ctx: *QueryCtx,
    id: u32,
    node: db.Node,
    field: u8,
    prop: t.Prop,
    typeEntry: db.Type,
    edgeRef: ?types.RefStruct,
    comptime isEdge: bool,
) !?*results.Result {
    var value: []u8 = undefined;
    var fieldSchema: *const selva.SelvaFieldSchema = undefined;
    var result: results.Result = undefined;
    if (isEdge) {
        if (edgeRef.?.edgeConstaint == null) {
            return errors.DbIncludeError.EDGE_FROM_WEAKREF;
        }
        fieldSchema = try db.getEdgeFieldSchema(ctx.db.selva.?, edgeRef.?.edgeConstaint.?, field);
        if (prop == t.Prop.CARDINALITY) {
            // make this in getEdgeProp
            value = db.getCardinalityReference(edgeRef.?.reference.?, fieldSchema);
        } else {
            value = db.getEdgeProp(edgeRef.?.reference.?, fieldSchema);
        }
        if (value.len == 0) {
            return null;
        }
        result = .{
            .type = t.ResultType.edge,
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
            .type = t.ResultType.none,
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

pub fn addUndefined(
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
    idIsSet: bool,
    comptime isEdge: bool,
    prop: u8,
) !usize {
    var result: results.Result = .{
        .type = if (isEdge) t.ResultType.undefinedEdge else t.ResultType.undefined,
        .prop = prop,
        .value = &.{},
        .id = 0,
        .score = null,
    };
    var size: usize = 2;
    if (!idIsSet) {
        size += 5;
        result.id = id;
        if (score != null) {
            result.score = score;
            size += 4;
        }
    }
    try ctx.results.append(result);
    return size;
}

pub inline fn default(
    result: *results.Result,
) !usize {
    return result.value.len + 5;
}

pub inline fn selvaString(
    result: *results.Result,
) !usize {
    var valueLen = result.*.value.len;
    if (valueLen == 0) {
        return 0;
    }
    valueLen = valueLen - 4;
    result.*.value = result.*.value[0..valueLen];
    return valueLen + 5;
}

pub inline fn partial(
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
    return size + 1;
}

pub inline fn textSpecific(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
    result: *results.Result,
    code: t.LangCode,
    idIsSet: bool,
) !usize {
    var idIsSetLocal: bool = idIsSet;
    var size: usize = 0;
    const s = db.getTextFromValue(result.*.value, code);
    if (s.len > 0) {
        if (isEdge) {
            size += (s.len + 6 - 4);
        } else {
            size += (s.len + 5 - 4);
        }
        var r: results.Result = .{
            .type = result.*.type,
            .id = 0,
            .score = score,
            .prop = result.*.prop,
            .value = s[0 .. s.len - 4],
        };
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
) !usize {
    var idIsSetLocal: bool = idIsSet;
    var size: usize = 0;
    const s = db.getTextFromValueFallback(result.*.value, code, fallbacks);
    if (s.len > 0) {
        if (isEdge) {
            size += (s.len + 6 - 4);
        } else {
            size += (s.len + 5 - 4);
        }
        var r: results.Result = .{
            .type = result.*.type,
            .id = 0,
            .score = score,
            .prop = result.*.prop,
            .value = s[0 .. s.len - 4],
        };
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
) !usize {
    var idIsSetLocal: bool = idIsSet;
    var size: usize = 0;
    var iter = db.textIterator(result.*.value);
    while (iter.next()) |s| {
        if (isEdge) {
            size += (s.len + 6 - 4);
        } else {
            size += (s.len + 5 - 4);
        }
        var r: results.Result = .{
            .type = result.*.type,
            .id = 0,
            .score = score,
            .prop = result.*.prop,
            .value = s[0 .. s.len - 4],
        };
        size += try add(ctx, id, score, idIsSetLocal, &r);
        idIsSetLocal = true;
    }
    return size;
}
