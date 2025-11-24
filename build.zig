const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const db = b.dependency("db", .{ .target = target });
    const db_check = &db.builder.top_level_steps.get("check").?.step;
    const check = b.step("check", "Check compilation errors");
    check.dependOn(db_check);
}
