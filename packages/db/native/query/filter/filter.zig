const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const read = @import("../../utils.zig").read;
const runCondition = @import("./conditions.zig").runConditions;
const QueryCtx = @import("../types.zig").QueryCtx;
const db = @import("../../db/db.zig");
const types = @import("../include/types.zig");
const std = @import("std");
const Prop = @import("../../types.zig").Prop;
const Meta = @import("./types.zig").Meta;
const Type = @import("./types.zig").Type;
const Mode = @import("./types.zig").Mode;
const LangCode = @import("../../types.zig").LangCode;
const ReferencesSelect = @import("../../types.zig").ReferencesSelect;
const filterReferences = @import("./references.zig").filterReferences;

const EMPTY: [1]u8 = [_]u8{0} ** 1;
const EMPTY_SLICE = @constCast(&EMPTY)[0..1];

inline fn fail(
    ctx: *db.DbCtx,
    node: db.Node,
    threadCtx: *db.DbThread,
    typeEntry: db.Type,
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
            threadCtx,
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
    threadCtx: *db.DbThread,
    typeEntry: db.Type,
    conditions: []u8,
    ref: ?types.RefStruct,
    jump: ?[]u8,
    offset: usize,
    comptime isEdge: bool,
) bool {
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
                    threadCtx,
                    typeEntry,
                    conditions[0 .. i + 3 + size],
                    ref,
                    null,
                    i + 3,
                    true,
                )) {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                }
                i += size + 3;
            } else {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            }
        } else if (meta == Meta.references) {
            const refField: u8 = conditions[i + 1];
            const refTypePrefix = read(u16, conditions, i + 2);
            const refsSelectType: ReferencesSelect = @enumFromInt(conditions[i + 4]);
            const size = read(u16, conditions, i + 9);
            const fieldSchema = db.getFieldSchema(typeEntry, refField) catch {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            };
            const references = db.getReferences(node, fieldSchema);
            if (references == null) {
                return false;
            }
            const refTypeEntry = db.getType(ctx, refTypePrefix) catch {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            };
            if (!filterReferences(
                refsSelectType,
                ctx,
                threadCtx,
                conditions[i + 11 .. i + 11 + size],
                db.getEdgeFieldConstraint(fieldSchema),
                .{ .refs = references.?, .fs = fieldSchema },
                refTypeEntry,
                read(i32, conditions, i + 5),
            )) {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            }
            i += size + 11;
        } else if (meta == Meta.reference) {
            const refField: u8 = conditions[i + 1];
            const refTypePrefix = read(u16, conditions, i + 2);
            const size = read(u16, conditions, i + 4);
            const fieldSchema = db.getFieldSchema(typeEntry, refField) catch {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            };
            const selvaRef = db.getSingleReference(node, fieldSchema);
            const dstType = db.getRefDstType(ctx, fieldSchema) catch {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            };
            const refNode: ?db.Node = db.getNodeFromReference(dstType, selvaRef);
            const edgeConstraint: db.EdgeFieldConstraint = db.getEdgeFieldConstraint(fieldSchema);
            if (refNode == null) {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            }
            const refTypeEntry = db.getType(ctx, refTypePrefix) catch {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            };
            if (!filter(
                ctx,
                refNode.?,
                threadCtx,
                refTypeEntry,
                conditions[0 .. i + 6 + size],
                .{
                    .smallReference = null,
                    .largeReference = @ptrCast(selvaRef.?),
                    .edgeConstraint = edgeConstraint,
                },
                null,
                i + 6,
                false,
            )) {
                return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
            }
            i += size + 6;
        } else if (meta == Meta.exists) {
            const field: u8 = conditions[i + 1];
            const negate: Type = @enumFromInt(conditions[i + 2]);
            const prop: Prop = @enumFromInt(conditions[i + 3]);

            var te: db.Type = undefined;
            var fs: db.FieldSchema = undefined;

            if (isEdge) {
                if (ref) |r| {
                    te = db.getEdgeType(ctx, r.edgeConstraint) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                    fs = db.getEdgeFieldSchema(ctx, r.edgeConstraint, field) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                } else if (negate == Type.default) {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                } else {
                    return true;
                }
            } else {
                te = typeEntry;
                fs = db.getFieldSchemaByNode(ctx, node, field) catch {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                };
            }

            if (prop == Prop.REFERENCES) {
                const refs = db.getReferences(node, fs);
                if ((negate == Type.default and refs.?.nr_refs == 0) or (negate == Type.negate and refs.?.nr_refs != 0)) {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else if (prop == Prop.REFERENCE) {
                const dstType = db.getRefDstType(ctx, fs) catch {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                };
                const checkRef = db.getNodeFromReference(dstType, db.getSingleReference(node, fs));
                if ((negate == Type.default and checkRef == null) or (negate == Type.negate and checkRef != null)) {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else {
                const fieldSchema = db.getFieldSchema(te, field) catch {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                };
                const value = db.getField(te, node, fieldSchema, prop);

                if ((negate == Type.default and value.len == 0) or (negate == Type.negate and value.len != 0)) {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
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
                if (value.len == 0 or !runCondition(
                    threadCtx.decompressor,
                    &threadCtx.libdeflateBlockState,
                    query,
                    value,
                )) {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else {
                if (i + 5 > end) {
                    break;
                }

                var te: db.Type = undefined;
                var actNode: db.Node = undefined;
                var fieldSchema: db.FieldSchema = undefined;

                if (isEdge) {
                    te = db.getEdgeType(ctx, ref.?.edgeConstraint) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                    if (db.getNode(te, ref.?.largeReference.?.edge)) |n| {
                        actNode = n;
                    } else {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    }
                    fieldSchema = db.getEdgeFieldSchema(ctx, ref.?.edgeConstraint, field) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                } else {
                    te = typeEntry;
                    actNode = node;
                    fieldSchema = db.getFieldSchema(te, field) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                }

                const prop: Prop = @enumFromInt(conditions[i + 5]);
                if (prop == Prop.TEXT) {
                    value = db.getField(te, actNode, fieldSchema, prop);
                    if (value.len == 0) {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    }
                    const fallBackSize: u8 = query[query.len - 1];
                    const lang: LangCode = @enumFromInt(query[query.len - 2]);
                    if (lang == LangCode.NONE) {
                        var f: usize = 0;
                        var iter = db.textIterator(value);
                        while (iter.next()) |s| {
                            if (!runCondition(
                                threadCtx.decompressor,
                                &threadCtx.libdeflateBlockState,
                                query,
                                s,
                            )) {
                                f += 1;
                            } else {
                                // 1 match is enough
                                break;
                            }
                        }
                        if (f == iter.value.len) {
                            return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else if (fallBackSize > 0) {
                        const s = db.getTextFromValueFallback(
                            value,
                            lang,
                            query[query.len - 2 - fallBackSize .. query.len - 2],
                        );
                        if (s.len == 0 or !runCondition(
                            threadCtx.decompressor,
                            &threadCtx.libdeflateBlockState,
                            query,
                            s,
                        )) {
                            return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else {
                        const s = db.getTextFromValue(value, lang);
                        if (s.len == 0 or !runCondition(
                            threadCtx.decompressor,
                            &threadCtx.libdeflateBlockState,
                            query,
                            s,
                        )) {
                            return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    }
                } else {
                    if (prop == Prop.REFERENCE) {
                        const dstType = db.getRefDstType(ctx, fieldSchema) catch {
                            return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        };
                        const checkRef = db.getNodeFromReference(dstType, db.getSingleReference(actNode, fieldSchema));
                        // -----------
                        if (checkRef) |r| {
                            value = db.getNodeIdAsSlice(r);
                        } else {
                            return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else if (prop == Prop.REFERENCES) {
                        const refs = db.getReferences(actNode, fieldSchema);
                        if (refs) |r| {
                            if (r.nr_refs != 0) {
                                const arr: [*]u8 = @ptrCast(@alignCast(r.*.index));
                                value = arr[0 .. r.nr_refs * 4];
                            } else {
                                value = EMPTY_SLICE;
                            }
                        } else {
                            return fail(ctx, actNode, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else {
                        value = db.getField(te, actNode, fieldSchema, prop);
                    }
                    if (value.len == 0 or !runCondition(
                        threadCtx.decompressor,
                        &threadCtx.libdeflateBlockState,
                        query,
                        value,
                    )) {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    }
                }
            }
            i += querySize + 3;
        }
    }
    return true;
}
