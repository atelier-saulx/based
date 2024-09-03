const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const readInt = @import("std").mem.readInt;
const runCondition = @import("./conditions.zig").runConditions;
const QueryCtx = @import("../ctx.zig").QueryCtx;
const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");

const getField = db.getField;
const idToShard = db.idToShard;

pub fn filter(
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    conditions: []u8,
) bool {
    var fieldIndex: usize = 0;
    var main: ?[]u8 = undefined;
    while (fieldIndex < conditions.len) {
        const field = conditions[fieldIndex];
        const operation = conditions[fieldIndex + 1 ..];
        const querySize: u16 = readInt(
            u16,
            operation[0..2],
            .little,
        );
        if (field == 254) {
            const refTypePrefix: [2]u8 = .{ operation[4], operation[5] };
            if (main == null) {
                const fieldSchema = db.getFieldSchema(0, typeEntry) catch {
                    return false;
                };
                main = db.getField(node, fieldSchema);
                if (main.?.len == 0) {
                    return false;
                }
            }
            const refStart: u16 = readInt(u16, operation[2..4], .little);
            const refId = readInt(u32, main.?[refStart..][0..4], .little);
            if (refId > 0) {
                const refConditions: []u8 = operation[6 .. 2 + querySize];

                const refTypeEntry = db.getType(refTypePrefix) catch {
                    return false;
                };
                // pass this refactor single ref
                const refNode = db.getNode(refId, refTypeEntry);

                if (refNode == null) {
                    return false;
                }

                if (!filter(refNode.?, refTypeEntry, refConditions)) {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            const query = operation[2 .. 2 + querySize];
            if (field == 0) {
                if (main == null) {
                    const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                        return false;
                    };
                    main = db.getField(node, fieldSchema);
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
                const value = db.getField(node, fieldSchema);
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
