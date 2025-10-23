const selva = @import("../../../selva.zig").c;
const Fn = @import("../types.zig").VectorFn;
const std = @import("std");
const MaxVectorScore = @import("../types.zig").MaxVectorScore;

pub fn vec(func: Fn, value: []const f32, query: []const f32) f32 {
    if (value.len != query.len) {
        return MaxVectorScore;
    }
    if (func == Fn.cosineSimilarity) {
        return @abs(1 - selva.vector_sc(value.ptr, query.ptr, query.len));
    } else if (func == Fn.dotProduct) {
        return @abs(1 - selva.vector_dot(value.ptr, query.ptr, query.len));
    } else if (func == Fn.manhattanDistance) {
        return @abs(selva.vector_l1(value.ptr, query.ptr, query.len));
    } else if (func == Fn.euclideanDistance) {
        return @abs(selva.vector_l2s(value.ptr, query.ptr, query.len));
    }
    return MaxVectorScore;
}
