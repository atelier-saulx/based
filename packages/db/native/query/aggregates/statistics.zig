const std = @import("std");

pub const setType = enum { Population, Sample };

const accumulator = struct {
    count: usize = 0,
    sum: f64 = 0.0,
    sum_sq: f64 = 0.0,
    min: f64,
    max: f64,
};

fn accumulate(comptime data: []const f64) accumulator {
    comptime var _count: usize = 0;
    comptime var _sum: f64 = 0.0;
    comptime var _sum_sq: f64 = 0.0;
    comptime var _min: f64 = std.math.inf(f64);
    comptime var _max: f64 = -std.math.inf(f64);

    inline for (data) |value| {
        comptime std.debug.assert(std.math.isFinite(value)); // f64!

        _count += 1;
        _sum += value;
        _sum_sq += value * value;
        _min = @min(_min, value);
        _max = @max(_max, value);
    }

    return .{
        .count = _count,
        .sum = _sum,
        .sum_sq = _sum_sq,
        .min = _min, // remains Infiity if count == 0
        .max = _max,
    };
}

pub fn count(comptime data: []const f64) usize {
    return accumulate(data).count;
}

pub fn sum(comptime data: []const f64) f64 {
    return accumulate(data).sum;
}

pub fn min(comptime data: []const f64) ?f64 {
    const state = accumulate(data);
    if (state.count == 0) return null;
    return state.min;
}

pub fn max(comptime data: []const f64) ?f64 {
    const state = accumulate(data);
    if (state.count == 0) return null;
    return state.max;
}

pub fn avg(comptime data: []const f64) ?f64 {
    const state = accumulate(data);
    if (state.count == 0) return null;
    const n = @as(f64, @floatFromInt(state.count));
    return state.sum / n;
}

pub fn variancePop(comptime data: []const f64) ?f64 {
    const state = accumulate(data);
    if (state.count == 0) return null;
    const n = @as(f64, @floatFromInt(state.count));

    const _avg = state.sum / n;
    const _variance = (state.sum_sq / n) - (_avg * _avg);

    if (_variance < 0.0 and _variance > -1e-12) return 0.0;
    if (_variance < 0.0) return null;

    return _variance;
}

pub fn varianceSample(comptime data: []const f64) ?f64 {
    const state = accumulate(data);
    if (state.count < 2) return null;
    const n = @as(f64, @floatFromInt(state.count));
    const numerator = state.sum_sq - (state.sum * state.sum) / n;
    const denominator = n - 1.0;
    const _variance = numerator / denominator;

    if (_variance < 0.0 and _variance > -1e-12) return 0.0;
    if (_variance < 0.0) return null;

    return _variance;
}

pub fn variance(comptime data: []const f64, kind: setType) ?f64 {
    return switch (kind) {
        .Population => variancePop(data),
        .Sample => varianceSample(data),
    };
}

pub fn stdDev(comptime data: []const f64, kind: setType) ?f64 {
    const _variance: ?f64 = variance(data, kind);

    if (_variance) |v| {
        return std.math.sqrt(v);
    } else {
        return null;
    }
}
