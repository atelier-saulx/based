/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct selva_io;

void sdb_init(struct selva_io *io);
void sdb_deinit(struct selva_io *io);

int sdb_write_header(struct selva_io *io);
int sdb_read_header(struct selva_io *io);
int sdb_write_footer(struct selva_io *io);
int sdb_read_footer(struct selva_io *io);

/**
 * Read the hash while io is at any arbitrary offset.
 */
int sdb_read_hash(struct selva_io *io);
