const selva = @import("../../../selva.zig");
const Fn = @import("../types.zig").VectorFn;
const std = @import("std");

pub fn vec(func: Fn, value: []const f32, query: []const f32) f32 {
    if (value.len != query.len) {
        // error.SELVA_EINVAL
        return 99999999;
    }

    if (func == Fn.cosineSimilarity) {
        return selva.vector_sc(value.ptr, query.ptr, query.len);
    } else if (func == Fn.dotProduct) {
        return selva.vector_dot(value.ptr, query.ptr, query.len);
    } else if (func == Fn.manhattanDistance) {
        return selva.vector_l1(value.ptr, query.ptr, query.len);
    } else if (func == Fn.euclideanDistance) {
        return selva.vector_l2s(value.ptr, query.ptr, query.len);
    }

    return 99999999;
}
