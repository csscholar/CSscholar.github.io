
all: js

.PHONY: js
js:
	@echo "Building JS..."
	$(MAKE) -C js

.PHONY: clean
clean:
	$(MAKE) -C js clean