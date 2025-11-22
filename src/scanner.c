#include "tree_sitter/parser.h"
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

enum TokenType {
    COMMENT_BLOCK_CONTENT,
    VERBATIM_BLOCK_CONTENT,
    VERBATIM_START,
};

typedef struct {
    char *verbatim_suffix;
    uint32_t verbatim_length;
    uint32_t verbatim_capacity;
} Scanner;

static inline void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

static inline bool is_horizontal_space(int32_t c) {
    return c == ' ' || c == '\t' || c == '\r';
}

static inline void skip_horizontal_space(TSLexer *lexer) {
    while (is_horizontal_space(lexer->lookahead)) advance(lexer);
}

static bool ensure_capacity(Scanner *scanner, uint32_t size) {
    if (scanner->verbatim_capacity >= size) return true;
    uint32_t new_cap = scanner->verbatim_capacity ? scanner->verbatim_capacity : 64;
    while (new_cap < size) new_cap *= 2;
    char *new_buf = realloc(scanner->verbatim_suffix, new_cap);
    if (!new_buf) return false;
    scanner->verbatim_suffix = new_buf;
    scanner->verbatim_capacity = new_cap;
    return true;
}

static void clear_verbatim_suffix(Scanner *scanner) {
    scanner->verbatim_length = 0;
}

static bool scan_until_end_keyword(TSLexer *lexer, const char *keyword, enum TokenType result) {
    for (;;) {
        if (lexer->lookahead == 0) return false;

        lexer->mark_end(lexer);

        if (lexer->lookahead == '{') {
            advance(lexer);
            if (lexer->lookahead == '%') {
                advance(lexer);
                skip_horizontal_space(lexer);

                const char *p = keyword;
                while (*p && lexer->lookahead == *p) {
                    advance(lexer);
                    p++;
                }
                if (*p == '\0') {
                    skip_horizontal_space(lexer);
                    if (lexer->lookahead == '%') {
                        advance(lexer);
                        if (lexer->lookahead == '}') {
                            advance(lexer);
                            lexer->mark_end(lexer);
                            lexer->result_symbol = result;
                            return true;
                        }
                    }
                }
            }
        }

        advance(lexer);
    }
}

static bool scan_verbatim_start(Scanner *scanner, TSLexer *lexer) {
    lexer->mark_end(lexer);
    uint32_t length = 0;
    uint32_t last_non_space = 0;

    for (;;) {
        if (lexer->lookahead == 0 || lexer->lookahead == '\n') return false;

        if (lexer->lookahead == '%') {
            advance(lexer);
            if (lexer->lookahead == '}') {
                // Trim trailing horizontal whitespace.
                length = last_non_space;
                scanner->verbatim_length = length;
                advance(lexer); // consume '}'
                lexer->mark_end(lexer);
                lexer->result_symbol = VERBATIM_START;
                return true;
            }
            // Not a tag end, treat '%' as content.
            if (!ensure_capacity(scanner, length + 1)) return false;
            scanner->verbatim_suffix[length++] = '%';
            if (!is_horizontal_space('%')) last_non_space = length;
            continue;
        }

        if (!ensure_capacity(scanner, length + 1)) return false;
        scanner->verbatim_suffix[length] = (char)lexer->lookahead;
        if (!is_horizontal_space(lexer->lookahead)) {
            last_non_space = length + 1;
        }
        length++;
        advance(lexer);
    }
}

static bool scan_verbatim_content(Scanner *scanner, TSLexer *lexer) {
    for (;;) {
        if (lexer->lookahead == 0) return false;

        lexer->mark_end(lexer);

        if (lexer->lookahead == '{') {
            advance(lexer);
            if (lexer->lookahead == '%') {
                advance(lexer);
                skip_horizontal_space(lexer);

                const char *kw = "endverbatim";
                const char *p = kw;
                while (*p && lexer->lookahead == *p) {
                    advance(lexer);
                    p++;
                }
                if (*p == '\0') {
                    uint32_t i = 0;
                    while (i < scanner->verbatim_length && lexer->lookahead == scanner->verbatim_suffix[i]) {
                        advance(lexer);
                        i++;
                    }
                    if (i == scanner->verbatim_length) {
                        skip_horizontal_space(lexer);
                        if (lexer->lookahead == '%') {
                            advance(lexer);
                            if (lexer->lookahead == '}') {
                                advance(lexer);
                                lexer->mark_end(lexer);
                                lexer->result_symbol = VERBATIM_BLOCK_CONTENT;
                                clear_verbatim_suffix(scanner);
                                return true;
                            }
                        }
                    }
                }
            }
        }

        advance(lexer);
    }
}

bool tree_sitter_htmldjango_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;

    if (valid_symbols[COMMENT_BLOCK_CONTENT]) {
        return scan_until_end_keyword(lexer, "endcomment", COMMENT_BLOCK_CONTENT);
    }

    if (valid_symbols[VERBATIM_START]) {
        return scan_verbatim_start(scanner, lexer);
    }

    if (valid_symbols[VERBATIM_BLOCK_CONTENT]) {
        return scan_verbatim_content(scanner, lexer);
    }

    return false;
}

void *tree_sitter_htmldjango_external_scanner_create() {
    Scanner *scanner = (Scanner *)calloc(1, sizeof(Scanner));
    return scanner;
}

void tree_sitter_htmldjango_external_scanner_destroy(void *payload) {
    if (!payload) return;
    Scanner *scanner = (Scanner *)payload;
    free(scanner->verbatim_suffix);
    free(scanner);
}

unsigned tree_sitter_htmldjango_external_scanner_serialize(void *payload, char *buffer) {
    Scanner *scanner = (Scanner *)payload;
    if (!scanner || scanner->verbatim_length == 0) return 0;

    uint32_t length = scanner->verbatim_length > 255 ? 255 : scanner->verbatim_length;
    buffer[0] = (char)length;
    memcpy(buffer + 1, scanner->verbatim_suffix, length);
    return length + 1;
}

void tree_sitter_htmldjango_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    Scanner *scanner = (Scanner *)payload;
    clear_verbatim_suffix(scanner);
    if (length == 0) return;

    uint32_t stored = (unsigned char)buffer[0];
    if (stored > length - 1) stored = length - 1;
    if (!ensure_capacity(scanner, stored)) {
        clear_verbatim_suffix(scanner);
        return;
    }
    memcpy(scanner->verbatim_suffix, buffer + 1, stored);
    scanner->verbatim_length = stored;
}
