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
// meta
// 0 conditions field check
// 1 or
// 252 edge
// 254 reference
// -------------------------------------------
// or
// [1, next, next]
// -------------------------------------------
// edge
// [252, edgeField]
// -------------------------------------------
// ref
// [254, field]
// -------------------------------------------
// normal
// [0, field, [size 2], [start 2], op, value...]

// or fixed
// [1, [repeat 2], field, [size 2], [start 2], op, value...]

// or VAR
// [2, [repeat 2], field, [size 4], [start 2], op, [size 2], value.., [size 2], value..]
// -------------------------------------------
// operations
// 1 = equality
// 2 = has (simd)
// 3 = checksum equality
// 4 = ends with
// 5 = starts with

// 6 = larger then
// 7 = smaller then

// lower case for strings
// 8 = equality to lower case
// 9 = has to lower case (simd)
// 10 = starts with to lower case
// 11 = ends with to lower case
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
    var main: ?[]u8 = undefined;

    // next OR

    // stop at next OR then its correct
    while (fieldIndex < conditions.len) {
        const field = conditions[fieldIndex];
        const operation = conditions[fieldIndex + 1 ..];
        const querySize: u16 = readInt(u16, operation, 0);
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
            const refField: u8 = operation[2];
            const refTypePrefix = readInt(u16, operation, 3);
            const refNode = db.getReference(node, refField);
            if (refNode == null) {
                return false;
            }
            const refTypeEntry = db.getType(ctx, refTypePrefix) catch {
                return false;
            };
            const refConditions: []u8 = operation[5 .. 1 + querySize];
            if (!filter(ctx, refNode.?, refTypeEntry, refConditions, null)) {
                return false;
            }
        } else {
            const query = operation[2 .. 2 + querySize];
            if (field == 0) {
                if (main == null) {
                    const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                        return false;
                    };
                    // get edge
                    main = db.getField(typeEntry, 0, node, fieldSchema);
                    if (main.?.len == 0) {
                        return false;
                    }
                }
                if (!runCondition(main.?, query)) {
                    return false;
                }
            } else {
                const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                    return false;
                };
                // get edge
                const value = db.getField(typeEntry, 0, node, fieldSchema);
                if (value.len == 0) {
                    return false;
                }
                if (!runCondition(value, query)) {
                    return false;
                }
            }
        }
        fieldIndex += querySize + 3;
    }
    return true;
}
