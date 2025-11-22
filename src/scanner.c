#include "tree_sitter/parser.h"
#include <wctype.h>

enum TokenType {
    COMMENT_BLOCK_CONTENT,
    VERBATIM_BLOCK_CONTENT,
};

static inline void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

static inline void skip_whitespace(TSLexer *lexer) {
    while (iswspace(lexer->lookahead)) advance(lexer);
}

static bool scan_until_end(TSLexer *lexer, const char *end_keyword, enum TokenType result) {
    for (;;) {
        if (lexer->lookahead == 0) return false;

        lexer->mark_end(lexer);

        if (lexer->lookahead == '{') {
            advance(lexer);
            if (lexer->lookahead == '%') {
                advance(lexer);
                skip_whitespace(lexer);

                // Try to match the closing keyword.
                const char *p = end_keyword;
                while (*p && lexer->lookahead == *p) {
                    advance(lexer);
                    p++;
                }
                if (*p == '\0') {
                    lexer->result_symbol = result;
                    return true;
                }
            }
        }

        advance(lexer);
    }
}

bool tree_sitter_htmldjango_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    if (valid_symbols[COMMENT_BLOCK_CONTENT]) {
        return scan_until_end(lexer, "endcomment", COMMENT_BLOCK_CONTENT);
    }

    if (valid_symbols[VERBATIM_BLOCK_CONTENT]) {
        return scan_until_end(lexer, "endverbatim", VERBATIM_BLOCK_CONTENT);
    }

    return false;
}

void *tree_sitter_htmldjango_external_scanner_create() {
    return NULL;
}

void tree_sitter_htmldjango_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_htmldjango_external_scanner_serialize(void *payload, char *buffer) {
    return 0;
}

void tree_sitter_htmldjango_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}
