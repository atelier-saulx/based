# Copyright (c) 2022-2023 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   db.o \
	   module/alias.o \
	   module/comparator.o \
	   module/dump.o \
	   module/edge/edge.o \
	   module/edge/edge_constraint.o \
	   module/find_index/find_index.o \
	   module/find_index/icb.o \
	   module/find_index/pick_icb.o \
	   module/hierarchy/field_set.o \
	   module/hierarchy/hierarchy.o \
	   module/hierarchy/hierarchy_detached.o \
	   module/hierarchy/hierarchy_inactive.o \
	   module/hierarchy/hierarchy_reply.o \
	   module/hierarchy/traversal.o \
	   module/hierarchy/traversal_order.o \
	   module/hierarchy/types.o \
	   module/modify.o \
	   module/parsers/enum.o \
	   module/parsers/string_list.o \
	   module/parsers/string_set.o \
	   module/query/aggregate.o \
	   module/query/find/find.o \
	   module/query/find/find_send_array_object_fields.o \
	   module/query/find/find_send_node_fields.o \
	   module/query/inherit/get_field.o \
	   module/query/inherit/inherit.o \
	   module/query/inherit/send_field.o \
	   module/query/inherit/send_field_find.o \
	   module/query/update.o \
	   module/resolve.o \
	   module/rpn/rpn.o \
	   module/rpn/rpn_eval.o \
	   module/sdb_purge.o \
	   module/selva_lang.o \
	   module/selva_object/selva_object.o \
	   module/selva_object/selva_object_commands.o \
	   module/selva_object/selva_object_foreach.o \
	   module/selva_set/field_has.o \
	   module/selva_set/fielda_in_fieldb.o \
	   module/selva_set/fielda_in_setb.o \
	   module/selva_set/selva_set.o \
	   module/selva_set/seta_in_fieldb.o \
	   module/selva_set/seta_in_setb.o \
	   module/selva_type.o \
	   module/shared_strings.o \
	   module/subscriptions.o
DEP := $(OBJ:%.o=%.d)
CFLAGS += -I./include -include ../../tunables.h
LDFLAGS += -ldeflate -lutil -ljemalloc_selva
TARGET := ../mod_db$(MOD_SUFFIX)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
