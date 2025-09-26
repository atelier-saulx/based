// zig fmt: off
const std = @import("std");
const builtin = @import("builtin");
const string = []const u8;

pub const cache = "/Users/jimdebeer/saulx/based/packages/db/.zigmod/deps";

pub fn addAllTo(exe: *std.Build.Step.Compile) void {
    checkMinZig(builtin.zig_version, exe);
    @setEvalBranchQuota(1_000_000);
    for (packages) |pkg| {
        const module = pkg.module(exe);
        exe.root_module.addImport(pkg.import.?[0], module);
    }
    for (package_data._root.system_libs) |libname| {
        exe.linkSystemLibrary(libname);
        exe.linkLibC();
    }
    // clear module memo cache so addAllTo can be called more than once in the same build.zig
    inline for (comptime std.meta.declarations(package_data)) |decl| @field(package_data, decl.name).module_memo = null;
}

var link_lib_c = false;
pub const Package = struct {
    directory: string,
    import: ?struct { string, std.Build.LazyPath } = null,
    dependencies: []const *Package,
    c_include_dirs: []const string = &.{},
    c_source_files: []const string = &.{},
    c_source_flags: []const string = &.{},
    system_libs: []const string = &.{},
    frameworks: []const string = &.{},
    module_memo: ?*std.Build.Module = null,

    pub fn module(self: *Package, exe: *std.Build.Step.Compile) *std.Build.Module {
        if (self.module_memo) |cached| {
            return cached;
        }
        const b = exe.step.owner;
        const result = b.createModule(.{
            .target = exe.root_module.resolved_target,
        });
        if (self.import) |capture| {
            result.root_source_file = capture[1];
        }
        for (self.dependencies) |item| {
            const module_dep = item.module(exe);
            if (module_dep.root_source_file != null) {
                result.addImport(item.import.?[0], module_dep);
            }
            for (module_dep.include_dirs.items) |jtem| {
                switch (jtem) {
                    .path => result.addIncludePath(jtem.path),
                    .path_system, .path_after, .framework_path, .framework_path_system, .other_step, .config_header_step => {},
                }
            }
        }
        for (self.c_include_dirs) |item| {
            result.addIncludePath(.{ .cwd_relative = (b.fmt("{s}/{s}", .{ self.directory, item })) });
            exe.addIncludePath(.{ .cwd_relative = (b.fmt("{s}/{s}", .{ self.directory, item })) });
            link_lib_c = true;
        }
        for (self.c_source_files) |item| {
            exe.addCSourceFile(.{ .file = .{ .cwd_relative = (b.fmt("{s}/{s}", .{ self.directory, item })) }, .flags = self.c_source_flags });
            link_lib_c = true;
        }
        for (self.system_libs) |item| {
            result.linkSystemLibrary(item, .{});
            exe.linkSystemLibrary(item);
            link_lib_c = true;
        }
        for (self.frameworks) |item| {
            result.linkFramework(item, .{});
            exe.linkFramework(item);
            link_lib_c = true;
        }
        if (link_lib_c) {
            result.link_libc = true;
            exe.linkLibC();
        }
        self.module_memo = result;
        return result;
    }
};

fn checkMinZig(current: std.SemanticVersion, exe: *std.Build.Step.Compile) void {
    const min = std.SemanticVersion.parse("null") catch return;
    if (current.order(min).compare(.lt)) @panic(exe.step.owner.fmt("Your Zig version v{} does not meet the minimum build requirement of v{}", .{current, min}));
}

pub const dirs = struct {
    pub const _root = "";
    pub const _rwddk0mc60ty = "/Users/jimdebeer/saulx/based/packages/db";
    pub const _6ok85gktcmgr = cache ++ "/v/git/github.com/jwhear/roaring-zig/commit-60372756692651cc7676041f9d0f5dc4c5388cbb";
};

pub const package_data = struct {
    pub var _rwddk0mc60ty = Package{
        .directory = dirs._rwddk0mc60ty,
        .dependencies = &.{ },
    };
    pub var _6ok85gktcmgr = Package{
        .directory = dirs._6ok85gktcmgr,
        .import = .{ "roaring", .{ .cwd_relative = dirs._6ok85gktcmgr ++ "/src/roaring.zig" } },
        .dependencies = &.{ },
        .c_include_dirs = &.{ "croaring" },
        .c_source_files = &.{ "croaring/roaring.c" },
        .system_libs = &.{ "c" },
    };
    pub var _root = Package{
        .directory = dirs._root,
        .dependencies = &.{ &_rwddk0mc60ty, &_6ok85gktcmgr },
    };
};

pub const packages = &[_]*Package{
    &package_data._6ok85gktcmgr,
};

pub const pkgs = struct {
    pub const roaring = &package_data._6ok85gktcmgr;
};

pub const imports = struct {
};
