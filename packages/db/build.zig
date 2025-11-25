const std = @import("std");

fn runCommand(b: *std.Build, alloc: std.mem.Allocator, argv: []const []const u8) ![]u8 {
    const proc = try std.process.Child.run(.{
        .argv = argv,
        .allocator = alloc,
    });
    // The caller is now responsible for freeing proc.stdout.
    // We can free stderr right away as we don't use it.
    defer alloc.free(proc.stderr);
    defer alloc.free(proc.stdout);
    const result = std.mem.trimRight(u8, proc.stdout, " \n\r\t");
    return b.fmt("{s}", .{result});
}

fn currentNodeHeaderPath(b: *std.Build) ![]u8 {
    const alloc = std.heap.page_allocator;
    const argv = [_][]const u8{ "which", "node" };
    var result = try runCommand(b, alloc, &argv);
    const suffix = "/bin/node";
    if (std.mem.endsWith(u8, result, suffix)) {
        return b.fmt("{s}/include/node", .{result[0 .. result.len - suffix.len]});
    }
    return b.fmt("{s}/include/node", .{result});
}

fn currentNapiVersion(b: *std.Build) ![]u8 {
    const alloc = std.heap.page_allocator;
    const argv = [_][]const u8{ "node", "-p", "process.versions.napi" };
    const result = try runCommand(b, alloc, &argv);
    return b.fmt("{s}", .{result});
}

pub fn build(b: *std.Build) !void {
    const target = b.standardTargetOptions(.{});
    const options = b.addOptions();
    const enable_debug = b.option(bool, "enable_debug", "Enable debugging prints") orelse false;
    const opt: std.builtin.OptimizeMode = if (enable_debug) .Debug else .ReleaseFast;

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

    options.addOption(bool, "enable_debug", enable_debug);
    lib.root_module.addOptions("config", options);

    const node_hpath = try currentNodeHeaderPath(b);
    const napiVersion = try currentNapiVersion(b);
    const osName: []const u8 = if (target.result.os.tag == .macos) "darwin" else @tagName(target.result.os.tag);
    const dest_path = b.fmt("../../dist/lib/{s}_{s}/libbased-{s}.node", .{
        osName,
        @tagName(target.result.cpu.arch),
        napiVersion,
    });

    const rpath = b.option([]const u8, "rpath", "run-time search path") orelse "@loader_path";
    const lib_selva_path = b.option([]const u8, "libselvapath", "Path to the Selva Library") orelse "dist/lib/darwin_aarch64";
    const headers_selva_path = b.option([]const u8, "headersselvapath", "Path to the Selva Headers") orelse "dist/lib/darwin_aarch64/include";

    lib.root_module.addRPathSpecial(rpath);
    lib.root_module.addIncludePath(.{ .cwd_relative = node_hpath });
    lib.root_module.addIncludePath(b.path(headers_selva_path));
    lib.root_module.addLibraryPath(b.path(lib_selva_path));
    lib.root_module.linkSystemLibrary("selva", .{});
    lib.root_module.link_libc = true;

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
