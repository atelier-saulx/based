# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT
targets := util db deflate

all: $(targets)

$(targets):
	$(MAKE) -C $@

clean:
	for i in $(targets); do $(MAKE) -C $$i clean; done

.PHONY: $(targets)
