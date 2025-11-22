module.exports = grammar({
  name: "htmldjango",

  word: $ => $.identifier,

  extras: $ => [],

  externals: $ => [
    $._comment_block_content,
    $._verbatim_block_content
  ],

  conflicts: $ => [
    [$.filter_expression, $.lookup],
    [$.filter_expression, $.test_expression],
    [$.tag_argument, $.filter_expression],
    [$.generic_block, $.generic_tag],
    [$.if_block, $.generic_tag],
    [$.if_block, $.block],
    [$.assignment, $.lookup],
    [$.tag_argument, $.as_alias],
    [$.cycle_value, $.literal],
    [$.lookup, $.named_url_argument],
    [$.lookup, $.regroup_tag]
  ],

  rules: {
    template: $ => repeat($._node),

    _node: $ => choice(
      $.interpolation,
      $.block,
      $.line_comment,
      $.block_comment,
      $.content
    ),

    // Lexical pieces
    _ws: _ => token(prec(1, /[\t\n\r ]+/)),
    _tag_end: _ => token(prec(2, seq(optional(/[\t\n\r ]*/), "%}"))),

    identifier: _ => token(seq(/[A-Za-z]/, repeat(/\w/))),

    number: _ => token(seq(
      optional(choice("+", "-")),
      choice(
        seq(/\d+\.\d+/, optional(seq(/[eE]/, optional(choice("+", "-")), /\d+/))),
        seq(/\d+\./, /[eE]/, optional(choice("+", "-")), /\d+/),
        seq(/\.\d+/, optional(seq(/[eE]/, optional(choice("+", "-")), /\d+/))),
        seq(/\d+/, optional(seq(/[eE]/, optional(choice("+", "-")), /\d+/)))
      )
    )),

    string: _ => token(choice(
      seq("'", repeat(choice(/[^'\\\n]/, /\\./)), "'"),
      seq('"', repeat(choice(/[^"\\\n]/, /\\./)), '"')
    )),

    i18n_string: _ => token(seq(
      "_(",
      choice(
        seq("'", repeat(choice(/[^'\\\n]/, /\\./)), "'"),
        seq('"', repeat(choice(/[^"\\\n]/, /\\./)), '"')
      ),
      ")"
    )),

    content: _ => token(choice(/[^{}]+/, /\{/, /\}/)),

    // Comments
    line_comment: _ => token(seq("{#", /[^\n#]*(#[^}\n][^\n#]*)*/, "#}")),
    block_comment: $ => seq(
      "{%", optional($._ws), "comment", optional($._ws), $._tag_end,
      optional($._comment_block_content),
      "{%", optional($._ws), "endcomment", optional($._ws), $._tag_end
    ),

    // Interpolations / expressions
    interpolation: $ => seq(
      "{{",
      optional($._ws),
      $.filter_expression,
      optional($._ws),
      "}}"
    ),

    filter_expression: $ => prec.left(seq(
      $.primary_expression,
      repeat(seq(
        optional($._ws),
        "|",
        optional($._ws),
        $.filter_call
      ))
    )),

    primary_expression: $ => choice(
      $.literal,
      $.lookup
    ),

    literal: $ => choice(
      $.string,
      $.i18n_string,
      $.number
    ),

    lookup: $ => seq(
      $.identifier,
      repeat(seq(".", choice($.identifier, /\d+/)))
    ),

    filter_call: $ => prec.left(seq(
      $.filter_name,
      optional(seq(
        optional($._ws),
        ":",
        optional($._ws),
        $.filter_argument
      ))
    )),

    filter_name: $ => $.identifier,
    filter_argument: $ => choice($.literal, $.lookup),

    // Boolean / comparison expressions used in {% if %}
    test_expression: $ => $.or_expression,

    or_expression: $ => choice(
      prec.left(1, seq($.or_expression, $._ws, "or", $._ws, $.and_expression)),
      $.and_expression
    ),

    and_expression: $ => choice(
      prec.left(2, seq($.and_expression, $._ws, "and", $._ws, $.not_expression)),
      $.not_expression
    ),

    not_expression: $ => choice(
      prec(3, seq("not", $._ws, $.not_expression)),
      $.comparison_expression
    ),

    comparison_expression: $ => choice(
      prec.left(4, seq($.comparison_expression, $._ws, $.comparison_operator, $._ws, $.comparison_operand)),
      $.comparison_operand
    ),

    comparison_operand: $ => $.filter_expression,

    comparison_operator: $ => choice(
      token(seq("not", /[ \t\r\n]+/, "in")),
      token(seq("is", /[ \t\r\n]+/, "not")),
      "in",
      "is",
      "==",
      "!=",
      ">=",
      ">",
      "<=",
      "<"
    ),

    // Tag arguments
    tag_argument: $ => choice(
      $.assignment,
      $.as_alias,
      $.filter_expression
    ),

    assignment: $ => seq(
      $.identifier,
      optional($._ws),
      "=",
      optional($._ws),
      $.filter_expression
    ),

    as_alias: $ => seq(
      $.filter_expression,
      optional($._ws),
      "as",
      optional($._ws),
      $.identifier
    ),

    // Blocks / tags
    block: $ => choice(
      $.if_block,
      $.for_block,
      $.with_block,
      $.ifchanged_block,
      $.autoescape_block,
      $.filter_block,
      $.spaceless_block,
      $.verbatim_block,
      $.block_block,
      $.extends_tag,
      $.include_tag,
      $.load_tag,
      $.firstof_tag,
      $.cycle_tag,
      $.resetcycle_tag,
      $.csrf_token_tag,
      $.debug_tag,
      $.regroup_tag,
      $.now_tag,
      $.templatetag_tag,
      $.url_tag,
      $.widthratio_tag,
      $.lorem_tag,
      $.partialdef_block,
      $.partial_tag,
      $.querystring_tag,
      $.generic_block,
      $.generic_tag
    ),

    if_block: $ => seq(
      $.if_open,
      repeat($._node),
      $.if_tail
    ),

    if_open: $ => seq(
      "{%",
      optional($._ws),
      "if",
      $._ws,
      $.test_expression,
      $._tag_end
    ),

    elif_tag: $ => seq(
      "{%",
      optional($._ws),
      "elif",
      $._ws,
      $.test_expression,
      $._tag_end
    ),

    else_tag: $ => seq(
      "{%",
      optional($._ws),
      "else",
      $._tag_end
    ),

    endif_tag: $ => seq(
      "{%",
      optional($._ws),
      "endif",
      $._tag_end
    ),

    if_tail: $ => choice(
      seq($.elif_tag, repeat($._node), $.if_tail),
      seq($.else_tag, repeat($._node), $.endif_tag),
      $.endif_tag
    ),

    for_block: $ => seq(
      "{%",
      optional($._ws),
      "for",
      $._ws,
      $.loop_targets,
      $._ws,
      "in",
      $._ws,
      $.filter_expression,
      optional(seq($._ws, "reversed")),
      $._tag_end,
      repeat($._node),
      optional(seq(
        "{%",
        optional($._ws),
        "empty",
        $._tag_end,
        repeat($._node)
      )),
      "{%",
      optional($._ws),
      "endfor",
      $._tag_end
    ),

    loop_targets: $ => prec.left(seq(
      $.loop_target,
      repeat(seq(optional($._ws), ",", optional($._ws), $.loop_target))
    )),

    loop_target: _ => token(/[A-Za-z_][^,\s%}]*/),

    with_block: $ => seq(
      "{%",
      optional($._ws),
      "with",
      $._ws,
      repeat1(seq($.assignment, optional($._ws))),
      $._tag_end,
      repeat($._node),
      "{%",
      optional($._ws),
      "endwith",
      $._tag_end
    ),

    ifchanged_block: $ => seq(
      "{%",
      optional($._ws),
      "ifchanged",
      optional(seq($._ws, repeat1(seq($.filter_expression, optional($._ws))))),
      $._tag_end,
      repeat($._node),
      optional(seq(
        "{%",
        optional($._ws),
        "else",
        $._tag_end,
        repeat($._node)
      )),
      "{%",
      optional($._ws),
      "endifchanged",
      $._tag_end
    ),

    autoescape_block: $ => seq(
      "{%",
      optional($._ws),
      "autoescape",
      $._ws,
      choice("on", "off"),
      $._tag_end,
      repeat($._node),
      "{%",
      optional($._ws),
      "endautoescape",
      $._tag_end
    ),

    filter_block: $ => seq(
      "{%",
      optional($._ws),
      "filter",
      $._ws,
      $.filter_chain,
      $._tag_end,
      repeat($._node),
      "{%",
      optional($._ws),
      "endfilter",
      $._tag_end
    ),

    filter_chain: $ => prec.left(seq(
      $.filter_call,
      repeat(seq(
        optional($._ws),
        "|",
        optional($._ws),
        $.filter_call
      ))
    )),

    spaceless_block: $ => seq(
      "{%",
      optional($._ws),
      "spaceless",
      $._tag_end,
      repeat($._node),
      "{%",
      optional($._ws),
      "endspaceless",
      $._tag_end
    ),

    verbatim_block: $ => seq(
      "{%",
      optional($._ws),
      "verbatim",
      optional(seq($._ws, $.identifier)),
      $._tag_end,
      optional($._verbatim_block_content),
      "{%",
      optional($._ws),
      "endverbatim",
      optional(seq($._ws, $.identifier)),
      $._tag_end
    ),

    block_block: $ => seq(
      "{%",
      optional($._ws),
      "block",
      $._ws,
      $.identifier,
      $._tag_end,
      repeat($._node),
      "{%",
      optional($._ws),
      "endblock",
      optional(seq($._ws, $.identifier)),
      $._tag_end
    ),

    extends_tag: $ => seq(
      "{%",
      optional($._ws),
      "extends",
      $._ws,
      $.filter_expression,
      $._tag_end
    ),

    include_tag: $ => seq(
      "{%",
      optional($._ws),
      "include",
      $._ws,
      $.filter_expression,
      optional(seq(
        $._ws,
        "with",
        $._ws,
        repeat1(seq($.assignment, optional($._ws)))
      )),
      optional(seq($._ws, "only")),
      $._tag_end
    ),

    load_tag: $ => seq(
      "{%",
      optional($._ws),
      "load",
      $._ws,
      choice(
        seq(
          repeat1(seq($.library_item, optional($._ws))),
          "from",
          $._ws,
          $.library_item
        ),
        repeat1(seq($.library_item, optional($._ws)))
      ),
      $._tag_end
    ),

    library_item: _ => token(/[A-Za-z_][\w.]*/),

    firstof_tag: $ => seq(
      "{%",
      optional($._ws),
      "firstof",
      $._ws,
      repeat1(seq($.filter_expression, optional($._ws))),
      optional(seq($._ws, "as", $._ws, $.identifier)),
      $._tag_end
    ),

    cycle_tag: $ => seq(
      "{%",
      optional($._ws),
      "cycle",
      $._ws,
      repeat1(seq($.cycle_value, optional($._ws))),
      optional(seq(
        $._ws,
        "as",
        $._ws,
        $.identifier,
        optional(seq($._ws, "silent"))
      )),
      $._tag_end
    ),

    cycle_value: $ => choice($.string, $.i18n_string, $.filter_expression),

    resetcycle_tag: $ => seq(
      "{%",
      optional($._ws),
      "resetcycle",
      optional(seq($._ws, $.identifier)),
      $._tag_end
    ),

    csrf_token_tag: $ => seq(
      "{%",
      optional($._ws),
      "csrf_token",
      optional($._ws),
      $._tag_end
    ),

    debug_tag: $ => seq(
      "{%",
      optional($._ws),
      "debug",
      optional($._ws),
      $._tag_end
    ),

    regroup_tag: $ => seq(
      "{%",
      optional($._ws),
      "regroup",
      $._ws,
      $.filter_expression,
      $._ws,
      "by",
      $._ws,
      choice($.identifier, $.lookup),
      $._ws,
      "as",
      $._ws,
      $.identifier,
      $._tag_end
    ),

    now_tag: $ => seq(
      "{%",
      optional($._ws),
      "now",
      $._ws,
      choice($.string, $.i18n_string),
      optional(seq($._ws, "as", $._ws, $.identifier)),
      $._tag_end
    ),

    templatetag_tag: $ => seq(
      "{%",
      optional($._ws),
      "templatetag",
      $._ws,
      choice(
        "openblock",
        "closeblock",
        "openvariable",
        "closevariable",
        "openbrace",
        "closebrace",
        "opencomment",
        "closecomment"
      ),
      $._tag_end
    ),

    url_tag: $ => seq(
      "{%",
      optional($._ws),
      "url",
      $._ws,
      $.filter_expression,
      repeat(seq(
        $._ws,
        choice($.named_url_argument, $.filter_expression)
      )),
      optional(seq($._ws, "as", $._ws, $.identifier)),
      $._tag_end
    ),

    named_url_argument: $ => seq(
      $.identifier,
      optional($._ws),
      "=",
      optional($._ws),
      $.filter_expression
    ),

    widthratio_tag: $ => seq(
      "{%",
      optional($._ws),
      "widthratio",
      $._ws,
      $.filter_expression,
      $._ws,
      $.filter_expression,
      $._ws,
      $.filter_expression,
      optional(seq(
        $._ws,
        "as",
        $._ws,
        $.identifier
      )),
      $._tag_end
    ),

    lorem_tag: $ => seq(
      "{%",
      optional($._ws),
      "lorem",
      repeat(seq(
        $._ws,
        choice($.filter_expression, "w", "p", "b", "random")
      )),
      $._tag_end
    ),

    partialdef_block: $ => seq(
      "{%",
      optional($._ws),
      "partialdef",
      $._ws,
      $.identifier,
      optional(seq($._ws, "inline")),
      $._tag_end,
      repeat($._node),
      "{%",
      optional($._ws),
      choice(
        seq("endpartialdef", optional(seq($._ws, $.identifier))),
        "endpartialdef"
      ),
      $._tag_end
    ),

    partial_tag: $ => seq(
      "{%",
      optional($._ws),
      "partial",
      $._ws,
      $.identifier,
      $._tag_end
    ),

    querystring_tag: $ => seq(
      "{%",
      optional($._ws),
      "querystring",
      repeat(seq($._ws, choice($.named_url_argument, $.filter_expression))),
      $._tag_end
    ),

    // Fallbacks for unknown tags
    generic_block: $ => prec.left(-5, seq(
      "{%",
      optional($._ws),
      field("name", $.identifier),
      repeat(seq($._ws, $.tag_argument)),
      $._tag_end,
      repeat($._node),
      "{%",
      optional($._ws),
      "end",
      field("end_name", $.identifier),
      repeat(seq($._ws, $.tag_argument)),
      $._tag_end
    )),

    generic_tag: $ => prec(-5, seq(
      "{%",
      optional($._ws),
      $.identifier,
      repeat(seq($._ws, $.tag_argument)),
      $._tag_end
    ))
  }
});
