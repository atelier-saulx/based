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
// [meta = 254] [field] [typeId 2]
// -------------------------------------------
// conditions normal
// field, [size 2]
// [or = 0] [size 2] [start 2], [op], value[size]
// -------------------------------------------
// conditions or fixed
// field, [size 2]
// [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
// -------------------------------------------
// conditions or variable
// field, [size 2]
// [or = 2] [size 2] [start 2], [op], [size 2], value[size], [size 2], value[size]
// -------------------------------------------
// operations shared
// 1 = equality
// 2 = has (simd)
// 3 = not equal
// 4 = ends with
// 5 = starts with
// -------------------------------------------
// operations numbers
// 6 = larger then
// 7 = smaller then
// 8 = larger then inclusive
// 9 = smaller then inclusive
// 10 = range
// 11 = exclude range
// -------------------------------------------
// operations strings
// 12 = equality to lower case
// 13 = has to lower case (simd)
// 14 = starts with to lower case
// 15 = ends with to lower case
// -------------------------------------------
// if 2 things to check in main that are next to each other make it

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
        const field = conditions[fieldIndex];
        if (field == 252) {
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
        } else if (field == 254) {
            const refField: u8 = conditions[fieldIndex + 1];
            const refTypePrefix = readInt(u16, conditions, fieldIndex + 3);
            const refNode = db.getReference(node, refField);
            if (refNode == null) {
                return false;
            }
            const refTypeEntry = db.getType(ctx, refTypePrefix) catch {
                return false;
            };

            std.debug.print("flap {any} \n", .{refTypeEntry});
            // const refConditions: []u8 = conditions[5 + fieldIndex .. 1 + querySize];
            // if (!filter(ctx, refNode.?, refTypeEntry, refConditions, null)) {
            //     return false;
            // }
            return false;
        } else {
            const querySize: u16 = readInt(u16, conditions, fieldIndex + 1);

            const query = conditions[fieldIndex + 3 .. querySize + fieldIndex + 3];

            const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                return false;
            };

            var value: []u8 = undefined;
            if (fieldSchema.type == 14) {
                const refs = db.getReferences(node, field);
                if (refs == null) {
                    return false;
                }
                const arr: [*]u8 = @ptrCast(@alignCast(refs.?.*.index));
                value = arr[0 .. refs.?.nr_refs * 4];
            } else {
                value = db.getField(typeEntry, 0, node, fieldSchema);
            }
            if (value.len == 0) {
                return false;
            }
            if (!runCondition(query, value)) {
                return false;
            }
            fieldIndex += querySize + 3;
        }
    }
    return true;
}
