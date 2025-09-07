# Switch the compiler from gcc to emcc
CC = emcc
CFLAGS = -g -Wall

# Add cJSON.o to our list of objects
OBJECTS = parser.tab.o lex.yy.o cJSON.o

# Target the new src/wasm directory
TARGET_JS = ../../frontend/src/wasm/engine.js
TARGET_WASM = ../../frontend/src/wasm/engine.wasm

# Emscripten-specific flags - CSP-safe configuration
EM_FLAGS = \
	-s WASM=1 \
	-s EXPORTED_FUNCTIONS="['_process_command']" \
	-s EXPORTED_RUNTIME_METHODS="['cwrap', 'UTF8ToString']" \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MALLOC=emmalloc \
	-s MODULARIZE=1 \
	-s EXPORT_ES6=1 \
	-s EXPORT_NAME='WasmEngine'

all: $(TARGET_JS)

$(TARGET_JS): $(OBJECTS)
	$(CC) $(CFLAGS) $(EM_FLAGS) -o $(TARGET_JS) $(OBJECTS)

# Add a rule to compile cJSON.c
cJSON.o: cJSON.c cJSON.h
	$(CC) $(CFLAGS) -c cJSON.c

parser.tab.c parser.tab.h: parser.y
	bison -d parser.y

lex.yy.c: lexer.l parser.tab.h
	flex -o lex.yy.c lexer.l

parser.tab.o: parser.tab.c
	$(CC) $(CFLAGS) -c parser.tab.c

lex.yy.o: lex.yy.c
	$(CC) $(CFLAGS) -c lex.yy.c

clean:
	rm -f *.o lex.yy.c parser.tab.c parser.tab.h $(TARGET_JS) $(TARGET_WASM)
