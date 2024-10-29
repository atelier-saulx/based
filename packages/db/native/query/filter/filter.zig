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
// or
// [meta = 253] [next 4]
// -------------------------------------------
// edge
// [meta = 252] [edgeField]
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

pub fn filter(
    ctx: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    conditions: []u8,
    ref: ?types.RefStruct,
    // comptime isEdge
) bool {
    var fieldIndex: usize = 0;
    // [or = 0] [size 2] [start 2], [op], value[size]
    // next OR

    // stop at next OR then its correct
    while (fieldIndex < conditions.len) {
        const meta: Meta = @enumFromInt(conditions[fieldIndex]);
        if (meta == Meta.edge) {
            if (ref != null) {
                return false;
            }
            //     const edgeField: u8 = operation[2];
            //     const edgeFieldSchema = db.getEdgeFieldSchema(ref.?.edgeConstaint, edgeField) catch null;
            //     if (edgeFieldSchema == null) {
            //         return false;
            //     }
            //     const value = db.getEdgeProp(ref.?.reference, edgeFieldSchema.?);
            //     if (value.len == 0) {
            //         return false;
            //     }
            //     if (!runCondition(value, operation[3 .. 3 + querySize])) {
            //         return false;
            //     }
            //     fieldIndex += querySize + 3;
            // } else {
            return false;
            // }
        } else if (meta == Meta.reference) {
            const refField: u8 = conditions[fieldIndex + 1];
            const refTypePrefix = readInt(u16, conditions, fieldIndex + 2);
            const refNode = db.getReference(node, refField);
            const size = readInt(u16, conditions, fieldIndex + 4);
            if (refNode == null) {
                return false;
            }
            const refTypeEntry = db.getType(ctx, refTypePrefix) catch {
                return false;
            };
            const refConditions: []u8 = conditions[6 .. 6 + size];
            if (!filter(ctx, refNode.?, refTypeEntry, refConditions, null)) {
                return false;
            }
            fieldIndex += size + 6;
        } else {
            const field: u8 = @intFromEnum(meta);
            const querySize: u16 = readInt(u16, conditions, fieldIndex + 1);
            const query = conditions[fieldIndex + 3 .. querySize + fieldIndex + 3];
            const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                return false;
            };
            const prop: Prop = @enumFromInt(fieldSchema.type);
            var value: []u8 = undefined;
            if (prop == Prop.REFERENCE) {
                const checkRef = db.getReference(node, field);
                if (checkRef) |r| {
                    value = @as([*]u8, @ptrCast(r))[0..8];
                } else {
                    return false;
                }
            } else if (prop == Prop.REFERENCES) {
                const refs = db.getReferences(node, field);
                if (refs) |r| {
                    const arr: [*]u8 = @ptrCast(@alignCast(r.*.index));
                    value = arr[0 .. r.nr_refs * 4];
                } else {
                    return false;
                }
            } else {
                value = db.getField(typeEntry, 0, node, fieldSchema);
            }
            if (value.len == 0 or !runCondition(ctx, query, value)) {
                return false;
            }
            fieldIndex += querySize + 3;
        }
    }
    return true;
}
