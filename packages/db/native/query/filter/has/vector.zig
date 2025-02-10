const selva = @import("../../../selva.zig");

pub fn sc(value: []const f32, query: []const f32) !f32 {
    if (value.len != query.len) {
        return error.SELVA_EINVAL;
    }
    return selva.vector_sc(value.ptr, query.ptr, query.len);
}
