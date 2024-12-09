const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");
const Prop = @import("../../types.zig").Prop;
const db = @import("../../db//db.zig");

pub inline fn crc32Equal(
    prop: Prop,
    query: []u8,
    v: []u8,
    comptime isEdge: bool,
    node: if (isEdge) *selva.SelvaNodeReference else *selva.SelvaNode,
    fieldSchema: ?db.FieldSchema,
) bool {
    const origLen = readInt(u32, query, 4);
    var valueLen: usize = undefined;
    if (prop == Prop.STRING and v[1] == 1) {
        valueLen = readInt(u32, v, 1);
    } else {
        valueLen = v.len;
    }
    if (origLen != valueLen) {
        return false;
    }
    var crc32: u32 = undefined;
    // if isEdge
    if (fieldSchema == null) {
        crc32 = selva.crc32c(0, v.ptr, v.len);
    } else {
        if (isEdge) {
            _ = selva.selva_fields_get_string_crc2(node.meta, fieldSchema, &crc32);
        } else {
            _ = selva.selva_fields_get_string_crc(node, fieldSchema, &crc32);
        }
    }
    const qCrc32 = readInt(u32, query, 0);
    if (crc32 != qCrc32) {
        return false;
    }

    return true;
}
