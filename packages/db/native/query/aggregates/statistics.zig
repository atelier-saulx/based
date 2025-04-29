const std = @import("std");
const AggFn = @import("../../types.zig").AggFn;

pub const statType = enum { Population, Sample };

pub const aggAccumulator = struct {
    count: usize = 0,
    sum: f64 = 0.0,
    sum_sq: f64 = 0.0,
    min: f64 = std.math.inf(f64),
    max: f64 = -std.math.inf(f64),

    // TODO: functions should go here? have to test allocation usage
    // TODO: test computation options for performance. bit opertions, divisions, Welford's alg (sxx)
    // TODO: valition to gyarantee usage only with number fields

    const Self = @This();

    pub fn update(self: *Self, value: f64, aggFn: AggFn) void {
        switch (aggFn) {
            .max => self.max = @max(self.max, value),
            .min => self.min = @min(self.min, value),
            .stddev => self.sum_sq += value * value,
            .variance => self.sum_sq += value * value,
        }
        self.count += 1;
        self.sum += value;
    }

    pub fn getCount(self: Self) usize {
        return self.count;
    }

    pub fn getSum(self: Self) f64 {
        return self.sum;
    }

    pub fn getMin(self: Self) ?f64 {
        if (self.count == 0) return null;
        return self.min;
    }

    pub fn getMax(self: Self) ?f64 {
        if (self.count == 0) return null;
        return self.max;
    }

    pub fn getAvg(self: Self) ?f64 {
        if (self.count == 0) return null;
        const n = @as(f64, @floatFromInt(self.count));
        return self.sum / n;
    }

    pub fn getVariancePop(self: Self) ?f64 {
        if (self.count == 0) return null;
        const n = @as(f64, @floatFromInt(self.count));
        if (n == 0.0) return null;

        const mean = self.sum / n;
        const variance = (self.sum_sq / n) - (mean * mean);

        if (variance < 0.0 and variance > -1e-12) return 0.0;
        if (variance < 0.0) return error.NegativeVariance;

        return variance;
    }

    pub fn getVarianceSample(self: Self) ?f64 {
        if (self.count < 2) return null;
        const n = @as(f64, @floatFromInt(self.count));
        const numerator = self.sum_sq - (self.sum * self.sum) / n;
        const denominator = n - 1.0;
        const variance = numerator / denominator;
        if (variance < 0.0 and variance > -1e-12) return 0.0;
        if (variance < 0.0) return error.NegativeVariance;
        return variance;
    }

    pub fn getVariance(self: Self, kind: statType) ?f64 {
        const varianceOpt: ?f64 = switch (kind) {
            .Population => self.getVariancePop(),
            .Sample => self.getVarianceSample(),
        };

        if (varianceOpt) |variance| {
            return variance;
        } else {
            return null;
        }
    }

    pub fn getStdDev(self: Self, kind: statType) ?f64 {
        const varianceOpt: ?f64 = switch (kind) {
            .Population => self.getVariancePop(),
            .Sample => self.getVarianceSample(),
        };

        if (varianceOpt) |variance| {
            return std.math.sqrt(variance);
        } else {
            return null;
        }
    }
};

// MV: Should add another struct to ordered sets after define allocation method
