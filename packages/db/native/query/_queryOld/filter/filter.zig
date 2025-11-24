const std = @import("std");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const read = @import("../../utils.zig").read;
const runCondition = @import("./conditions.zig").runConditions;
const Query = @import("../common.zig");
const db = @import("../../db/db.zig");
const Node = @import("../../db/node.zig");
const filterReferences = @import("./references.zig").filterReferences;
const t = @import("../../types.zig");

const EMPTY: [1]u8 = [_]u8{0} ** 1;
const EMPTY_SLICE = @constCast(&EMPTY)[0..1];

inline fn fail(
    ctx: *db.DbCtx,
    node: Node.Node,
    threadCtx: *db.DbThread,
    typeEntry: Node.Type,
    conditions: []u8,
    ref: ?Query.RefStruct,
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
    node: Node.Node,
    threadCtx: *db.DbThread,
    typeEntry: Node.Type,
    conditions: []u8,
    ref: ?Query.RefStruct,
    jump: ?[]u8,
    offset: usize,
    comptime isEdge: bool,
) bool {
    var i: usize = offset;
    var orJump: ?[]u8 = jump;
    var end: usize = conditions.len;

    while (i < end) {
        const meta: t.FilterMeta = @enumFromInt(conditions[i]);
        if (meta == t.FilterMeta.orBranch) {
            orJump = conditions[i + 1 .. i + 7];
            end = read(u32, conditions, i + 3);
            i += 7;
        } else if (meta == t.FilterMeta.edge) {
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
        } else if (meta == t.FilterMeta.references) {
            const refField: u8 = conditions[i + 1];
            const refTypePrefix = read(u16, conditions, i + 2);
            const refsSelectType: t.ReferencesSelect = @enumFromInt(conditions[i + 4]);
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
        } else if (meta == t.FilterMeta.reference) {
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
            const refNode: ?Node.Node = Node.getNodeFromReference(dstType, selvaRef);
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
        } else if (meta == t.FilterMeta.exists) {
            const field: u8 = conditions[i + 1];
            const negate: t.FilterType = @enumFromInt(conditions[i + 2]);
            const prop: t.PropType = @enumFromInt(conditions[i + 3]);

            var te: Node.Type = undefined;
            var fs: db.FieldSchema = undefined;

            if (isEdge) {
                if (ref) |r| {
                    te = db.getEdgeType(ctx, r.edgeConstraint) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                    fs = db.getEdgeFieldSchema(ctx, r.edgeConstraint, field) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                } else if (negate == t.FilterType.default) {
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

            if (prop == t.PropType.references) {
                const refs = db.getReferences(node, fs);
                if ((negate == t.FilterType.default and
                    refs.?.nr_refs == 0) or
                    (negate == t.FilterType.negate and
                        refs.?.nr_refs != 0))
                {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else if (prop == t.PropType.reference) {
                const dstType = db.getRefDstType(ctx, fs) catch {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                };
                const checkRef = Node.getNodeFromReference(dstType, db.getSingleReference(node, fs));
                if ((negate == t.FilterType.default and
                    checkRef == null) or
                    (negate == t.FilterType.negate and
                        checkRef != null))
                {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                }
            } else {
                const fieldSchema = db.getFieldSchema(te, field) catch {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                };
                const value = db.getField(te, node, fieldSchema, prop);

                if ((negate == t.FilterType.default and value.len == 0) or
                    (negate == t.FilterType.negate and
                        value.len != 0))
                {
                    return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                }
            }
            i += 4;
        } else {
            const field: u8 = @intFromEnum(meta);
            const querySize: u16 = read(u16, conditions, i + 1);
            const query = conditions[i + 3 .. querySize + i + 3];
            var value: []u8 = undefined;
            if (meta == t.FilterMeta.id) {
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

                var te: Node.Type = undefined;
                var actNode: Node.Node = undefined;
                var fieldSchema: db.FieldSchema = undefined;

                if (isEdge) {
                    te = db.getEdgeType(ctx, ref.?.edgeConstraint) catch {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    };
                    if (Node.getNode(te, ref.?.largeReference.?.edge)) |n| {
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

                const prop: t.PropType = @enumFromInt(conditions[i + 5]);
                if (prop == t.PropType.text) {
                    value = db.getField(te, actNode, fieldSchema, prop);
                    if (value.len == 0) {
                        return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                    }
                    const fallBackSize: u8 = query[query.len - 1];
                    const lang: t.LangCode = @enumFromInt(query[query.len - 2]);
                    if (lang == t.LangCode.NONE) {
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
                    if (prop == t.PropType.reference) {
                        const dstType = db.getRefDstType(ctx, fieldSchema) catch {
                            return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        };
                        const checkRef = Node.getNodeFromReference(dstType, db.getSingleReference(actNode, fieldSchema));
                        // -----------
                        if (checkRef) |r| {
                            value = db.getNodeIdAsSlice(r);
                        } else {
                            return fail(ctx, node, threadCtx, typeEntry, conditions, ref, orJump, isEdge);
                        }
                    } else if (prop == t.PropType.references) {
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
