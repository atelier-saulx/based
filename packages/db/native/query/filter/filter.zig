const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const read = @import("../../utils.zig").read;
const runCondition = @import("./conditions.zig").runConditions;
const QueryCtx = @import("../types.zig").QueryCtx;
const db = @import("../../db/db.zig");
const getThreadCtx = @import("../../db/ctx.zig").getThreadCtx;
const selva = @import("../../selva.zig");
const types = @import("../include/types.zig");
const std = @import("std");
const Prop = @import("../../types.zig").Prop;
const Meta = @import("./types.zig").Meta;
const Type = @import("./types.zig").Type;
const Mode = @import("./types.zig").Mode;
const LangCode = @import("../../types.zig").LangCode;

const EMPTY: [1]u8 = [_]u8{0} ** 1;
const EMPTY_SLICE = @constCast(&EMPTY)[0..1];

inline fn fail(
    ctx: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    conditions: []u8,
    ref: ?types.RefStruct,
    jump: ?[]u8,
    comptime isEdge: bool,
) bool {
    if (jump) |j| {
        const start = read(u32, j, 2);
        const size = read(u16, j, 0);
        return filter(
            ctx,
            node,
            typeEntry,
            conditions[0 .. size + start],
            ref,
            null,
            start,
            isEdge,
        );
    }
    return false;
}

pub fn filter(
    ctx: *db.DbCtx,
    node: db.Node,
    typeEntry: db.Type,
    conditions: []u8,
    ref: ?types.RefStruct,
    jump: ?[]u8,
    offset: usize,
    comptime isEdge: bool,
) bool {
    const tctx = getThreadCtx(ctx) catch return false;
    const decompressor = tctx.decompressor;
    const blockState = tctx.libdeflateBlockState;
    var i: usize = offset;
    var orJump: ?[]u8 = jump;
    var end: usize = conditions.len;

    while (i < end) {
        const meta: Meta = @enumFromInt(conditions[i]);
        if (meta == Meta.orBranch) {
            orJump = conditions[i + 1 .. i + 7];
            end = read(u32, conditions, i + 3);
            i += 7;
        } else if (meta == Meta.edge) {
            if (ref != null) {
                const size = read(u16, conditions, i + 1);
                if (!filter(
                    ctx,
                    node,
                    typeEntry,
                    conditions[0 .. i + 3 + size],
                    ref,
                    null,
                    i + 3,
                    true,
                )) {
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                }
                i += size + 3;
            } else {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            }
        } else if (meta == Meta.reference) {
            const refField: u8 = conditions[i + 1];
            const refTypePrefix = read(u16, conditions, i + 2);
            const size = read(u16, conditions, i + 4);
            const fieldSchema = db.getFieldSchema(typeEntry, refField) catch {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            };
            const selvaRef = db.getSingleReference(ctx, node, fieldSchema);
            const refNode: ?db.Node = selvaRef.?.*.dst;
            const edgeConstrain: *const selva.EdgeFieldConstraint = selva.selva_get_edge_field_constraint(fieldSchema);
            if (refNode == null) {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            }
            const refTypeEntry = db.getType(ctx, refTypePrefix) catch {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            };
            if (!filter(
                ctx,
                refNode.?,
                refTypeEntry,
                conditions[0 .. i + 6 + size],
                .{
                    .smallReference = null,
                    .largeReference = @ptrCast(selvaRef.?),
                    .edgeReference = null,
                    .edgeConstaint = edgeConstrain,
                },
                null,
                i + 6,
                false,
            )) {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            }
            i += size + 6;
        } else if (meta == Meta.exists) {
            const field: u8 = conditions[i + 1];
            const negate: Type = @enumFromInt(conditions[i + 2]);
            const prop: Prop = @enumFromInt(conditions[i + 3]);
            if (isEdge) {
                if (ref) |r| {
                    if (prop == Prop.REFERENCES) {
                        const refs = db.getEdgeReferences(r.largeReference.?, field);
                        if ((negate == Type.default and refs.?.nr_refs == 0) or (negate == Type.negate and refs.?.nr_refs != 0)) {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else if (prop == Prop.REFERENCE) {
                        const checkRef = db.getEdgeReference(r.largeReference.?, field);
                        if ((negate == Type.default and checkRef == null) or (negate == Type.negate and checkRef != null)) {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else if (r.edgeConstaint != null) {
                        const edgeFieldSchema = db.getEdgeFieldSchema(ctx, r.edgeConstaint.?, field) catch {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        };
                        const value = db.getEdgeProp(r.largeReference.?, edgeFieldSchema);
                        if ((negate == Type.default and value.len == 0) or (negate == Type.negate and value.len != 0)) {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else {
                        std.log.err("Trying to get an edge field from a weakRef \n", .{});
                        // Is a edge ref cant filter on an edge field!
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                } else if (negate == Type.default) {
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else {
                if (prop == Prop.REFERENCES) {
                    const fs = db.getFieldSchemaByNode(ctx, node, field) catch {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    };
                    const refs = db.getReferences(ctx, node, fs);
                    if ((negate == Type.default and refs.?.nr_refs == 0) or (negate == Type.negate and refs.?.nr_refs != 0)) {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                } else if (prop == Prop.REFERENCE) {
                    const fs = db.getFieldSchemaByNode(ctx, node, field) catch {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    };
                    const checkRef = db.getNodeFromReference(db.getSingleReference(ctx, node, fs));
                    if ((negate == Type.default and checkRef == null) or (negate == Type.negate and checkRef != null)) {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                } else {
                    const fieldSchema = db.getFieldSchema(typeEntry, field) catch {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    };
                    const value = db.getField(typeEntry, 0, node, fieldSchema, prop);
                    if ((negate == Type.default and value.len == 0) or (negate == Type.negate and value.len != 0)) {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                }
            }
            i += 4;
        } else {
            const field: u8 = @intFromEnum(meta);
            const querySize: u16 = read(u16, conditions, i + 1);
            const query = conditions[i + 3 .. querySize + i + 3];
            var value: []u8 = undefined;
            if (meta == Meta.id) {
                value = db.getNodeIdAsSlice(node);
                if (value.len == 0 or !runCondition(decompressor, blockState,  query, value)) {
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else if (isEdge) {
                if (ref.?.edgeConstaint == null) {
                    std.log.err("Trying to get an edge field from a weakRef (2) \n", .{});
                    // Is a edge ref cant filter on an edge field!
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                }

                const edgeFieldSchema = db.getEdgeFieldSchema(ctx, ref.?.edgeConstaint.?, field) catch {
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                };
                value = db.getEdgeProp(ref.?.largeReference.?, edgeFieldSchema);
                if (value.len == 0 or !runCondition(decompressor, blockState,  query, value)) {
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else {
                if (i + 5 > end) {
                    break;
                }
                const fieldSchema = db.getFieldSchema(typeEntry, field) catch {
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                };
                const prop: Prop = @enumFromInt(conditions[i + 5]);
                if (prop == Prop.TEXT) {
                    value = db.getField(typeEntry, 0, node, fieldSchema, prop);
                    if (value.len == 0) {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                    const fallBackSize: u8 = query[query.len - 1];
                    const lang: LangCode = @enumFromInt(query[query.len - 2]);
                    if (lang == LangCode.NONE) {
                        var f: usize = 0;
                        var iter = db.textIterator(value);
                        while (iter.next()) |s| {
                            if (!runCondition(decompressor, blockState, query, s)) {
                                f += 1;
                            } else {
                                // 1 match is enough
                                break;
                            }
                        }
                        if (f == iter.value.len) {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else if (fallBackSize > 0) {
                        const s = db.getTextFromValueFallback(
                            value,
                            lang,
                            query[query.len - 2 - fallBackSize .. query.len - 2],
                        );
                        if (s.len == 0 or !runCondition(decompressor, blockState,  query, s)) {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else {
                        const s = db.getTextFromValue(value, lang);
                        if (s.len == 0 or !runCondition(decompressor, blockState,  query, s)) {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    }
                } else {
                    if (prop == Prop.REFERENCE) {
                        const fs = db.getFieldSchemaByNode(ctx, node, field) catch {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        };
                        const checkRef = db.getNodeFromReference(db.getSingleReference(ctx, node, fs));
                        // -----------
                        if (checkRef) |r| {
                            value = db.getNodeIdAsSlice(r);
                        } else {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else if (prop == Prop.REFERENCES) {
                        // if edge different
                        const fs = db.getFieldSchemaByNode(ctx, node, field) catch {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        };
                        const refs = db.getReferences(ctx, node, fs);
                        if (refs) |r| {
                            if (r.nr_refs != 0) {
                                const arr: [*]u8 = @ptrCast(@alignCast(r.*.index));
                                value = arr[0 .. r.nr_refs * 4];
                            } else {
                                value = EMPTY_SLICE;
                            }
                        } else {
                            return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else {
                        value = db.getField(typeEntry, 0, node, fieldSchema, prop);
                    }
                    if (value.len == 0 or !runCondition(decompressor, blockState,  query, value)) {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                }
            }

            i += querySize + 3;
        }
    }
    return true;
}
