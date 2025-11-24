const std = @import("std");

fn currentNodeHeaderPath(b: *std.Build) []u8 {
    const alloc = std.heap.page_allocator;
    const argv = [_][]const u8{ "node", "--version" };
    const proc = std.process.Child.run(.{
        .argv = &argv,
        .allocator = alloc,
    }) catch |err| {
        std.debug.print("Failed to spawn child process: {s}\n", .{@errorName(err)});
        return b.fmt("deps/node-v22.21.1/include/node", .{});
    };
    // on success, we own the output streams
    defer alloc.free(proc.stdout);
    defer alloc.free(proc.stderr);
    const version = std.mem.trimRight(u8, proc.stdout, " \n\r\t%");
    return b.fmt("deps/node-{s}/include/node", .{version});
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const enable_debug = b.option(bool, "enable_debug", "Enable debugging prints") orelse false;
    const options = b.addOptions();

    options.addOption(bool, "enable_debug", enable_debug);

    const opt: std.builtin.OptimizeMode = switch (enable_debug) {
        true => .Debug,
        false => .ReleaseFast,
    };

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "based_db_zig",
        .root_module = b.createModule(.{
            .root_source_file = b.path("native/lib.zig"),
            .target = target,
            .optimize = opt,
            .link_libc = true,
        }),
    });

    lib.linker_allow_shlib_undefined = true;
    lib.root_module.addOptions("config", options);

    const node_hpath = b.option([]const u8, "node_hpath", "Path to the Node.js headers") orelse currentNodeHeaderPath(b);

    // Extract node major version from the header path
    var nodeVersion: []const u8 = "v22";
    var it = std.mem.splitScalar(u8, node_hpath, '-');
    _ = it.next(); // "node"
    if (it.next()) |version_part| {
        var version_it = std.mem.splitScalar(u8, version_part, '.');
        if (version_it.next()) |major| {
            nodeVersion = major;
        }
    }

    const osName: []const u8 = if (target.result.os.tag == .macos) "darwin" else @tagName(target.result.os.tag);
    const dest_path = b.fmt("../../dist/lib/{s}_{s}/libnode-{s}.node", .{
        osName,
        @tagName(target.result.cpu.arch),
        nodeVersion,
    });

    lib.addIncludePath(b.path(node_hpath));

    const rpath = b.option([]const u8, "rpath", "run-time search path") orelse "@loader_path";
    const lib_selva_path = b.option([]const u8, "libselvapath", "Path to the Selva Library") orelse "dist/lib/darwin_aarch64";
    const headers_selva_path = b.option([]const u8, "headersselvapath", "Path to the Selva Headers") orelse "dist/lib/darwin_aarch64/include";

    lib.root_module.addRPathSpecial(rpath);
    lib.addIncludePath(b.path(headers_selva_path));
    lib.addLibraryPath(b.path(lib_selva_path));
    lib.linkSystemLibrary("selva");
    lib.linkLibC();

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_sub_path = dest_path,
    });
    const install_step = b.getInstallStep();

    install_step.dependOn(&install_lib.step);

    // This creates a "check" step that allows zls (Zig Language Server) to analyze the code.
    // It reuses the same module definition from the library being built.
    const check_step = b.step("check", "Check compilation for zls");
    check_step.dependOn(&lib.step);
}
