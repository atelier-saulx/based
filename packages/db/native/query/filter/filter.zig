const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const readInt = @import("../../utils.zig").readInt;
const runCondition = @import("./conditions.zig").runConditions;
const QueryCtx = @import("../ctx.zig").QueryCtx;
const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const types = @import("../include//types.zig");
const std = @import("std");
const Prop = @import("../../types.zig").Prop;
const Meta = @import("./types.zig").Meta;

const getField = db.getField;
const idToShard = db.idToShard;
// -------------------------------------------
// and
// [meta = 255] [size 2]
// -------------------------------------------
// or
// [meta = 253]  [size 2] [next 4]
// -------------------------------------------
// edge
// [meta = 252] [size 2]
// -------------------------------------------
// ref
// [meta = 254] [field] [typeId 2] [size 2]
// -------------------------------------------
// conditions normal
// field, [size 2]
// [or = 0] [size 2] [start 2], [op] [typeIndex], value[size]
// -------------------------------------------
// conditions or fixed
// field, [size 2]
// [or = 1] [size 2] [start 2] [op] [typeIndex], [repeat 2], value[size] value[size] value[size]
// -------------------------------------------
// conditions or variable
// field, [size 2]
// [or = 2] [size 2] [start 2], [op] [typeIndex], [size 2], value[size], [size 2], value[size]
// -------------------------------------------

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
        const start = readInt(u32, j, 2);
        const size = readInt(u16, j, 0);
        return filter(ctx, node, typeEntry, conditions[start .. size + start], ref, null, isEdge);
    }
    return false;
}

pub fn filter(
    ctx: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    conditions: []u8,
    ref: ?types.RefStruct,
    jump: ?[]u8,
    comptime isEdge: bool,
) bool {
    var i: usize = 0;
    var orJump: ?[]u8 = null;

    // [or = 0] [size 2] [start 2], [op], value[size]
    // next OR
    while (i < conditions.len) {
        const meta: Meta = @enumFromInt(conditions[i]);
        if (meta == Meta.andBranch) {
            const size = readInt(u16, conditions, i + 1);
            // if (!filter(
            //     ctx,
            //     node,
            //     typeEntry,
            //     conditions[i + 3 .. i + 3 + size],
            //     ref,
            //     0,
            //     true,
            // )) {
            //     return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            // }
            i += 3 + size;
        } else if (meta == Meta.orBranch) {
            const size = readInt(u16, conditions, i + 1);
            orJump = conditions[i + 1 .. i + 7];
            i += 7 + size;
        } else if (meta == Meta.edge) {
            if (ref != null) {
                const size = readInt(u16, conditions, i + 1);
                if (!filter(
                    ctx,
                    node,
                    typeEntry,
                    conditions[i + 3 .. i + 3 + size],
                    ref,
                    null,
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
            const refTypePrefix = readInt(u16, conditions, i + 2);
            const size = readInt(u16, conditions, i + 4);
            const selvaRef = db.getSingleReference(node, refField);
            const refNode: ?db.Node = selvaRef.?.*.dst;
            const fieldSchema = db.getFieldSchema(refField, typeEntry) catch {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            };
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
                conditions[i + 6 .. i + 6 + size],
                .{
                    .reference = @ptrCast(selvaRef.?),
                    .edgeConstaint = edgeConstrain,
                },
                null,
                false,
            )) {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            }
            i += size + 6;
        } else {
            const field: u8 = @intFromEnum(meta);
            const querySize: u16 = readInt(u16, conditions, i + 1);
            const query = conditions[i + 3 .. querySize + i + 3];
            var value: []u8 = undefined;
            if (isEdge) {
                const edgeFieldSchema = db.getEdgeFieldSchema(ref.?.edgeConstaint, field) catch null;
                if (edgeFieldSchema == null) {
                    return fail(ctx, node, typeEntry, conditions, ref, jump, isEdge);
                }
                value = db.getEdgeProp(ref.?.reference, edgeFieldSchema.?);
            } else {
                const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                    return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                };
                const prop: Prop = @enumFromInt(fieldSchema.type);
                if (prop == Prop.REFERENCE) {
                    // if edge different
                    const checkRef = db.getReference(node, field);
                    if (checkRef) |r| {
                        value = @as([*]u8, @ptrCast(r))[0..8];
                    } else {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                } else if (prop == Prop.REFERENCES) {
                    // if edge different
                    const refs = db.getReferences(node, field);
                    if (refs) |r| {
                        const arr: [*]u8 = @ptrCast(@alignCast(r.*.index));
                        value = arr[0 .. r.nr_refs * 4];
                    } else {
                        return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
                    }
                } else {
                    value = db.getField(typeEntry, 0, node, fieldSchema);
                }
            }
            if (value.len == 0 or !runCondition(ctx, query, value)) {
                return fail(ctx, node, typeEntry, conditions, ref, orJump, isEdge);
            }
            i += querySize + 3;
        }
    }
    return true;
}
