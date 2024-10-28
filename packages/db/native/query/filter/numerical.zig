const readInt = @import("../../utils.zig").readInt;
const t = @import("./types.zig");
const Op = t.Operator;

pub inline fn compare(
    size: u16,
    _: Op,
    _: []u8,
    _: []u8,
) bool {
    if (size == 4) {

        // return readInt((u32, ))
    } else if (size == 8) {
        // return readInt((u32, ))
    } else if (size == 1) {
        // single
    }

    return false;
}
