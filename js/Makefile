
TARGETS = dataset.min.js author-vis.min.js

all: $(TARGETS)

%.min.js: %.js
	@echo "Minifying $<..."
	uglifyjs $< -o $@ -c -m
	rm $<

%.js: %.ts 
	@echo "Compiling $<..."
	tsc $< --target es6 --lib es6,dom,es2019 --typeRoots /usr/lib/node_modules/@types

clean:
	rm -f $(TARGETS)