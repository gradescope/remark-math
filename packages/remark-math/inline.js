function locator(value, fromIndex) {
  return value.indexOf('$', fromIndex)
}

const ESCAPED_INLINE_MATH = /^\\\$/ // starts with \$
const MATH_INLINE = /^\$\$((?:\\\$|[^$])+)\$\$/ // starts with $$, end match $$, capture content
const MATH_DISPLAY = /^\$\$\$((?:\\\$|[^$])+)\$\$\$/ // starts with $$$, end match $$$, capture content

module.exports = function inlinePlugin (opts) {
  function inlineTokenizer (eat, value, silent) {
    const displayMatch = MATH_DISPLAY.exec(value)
    const match = displayMatch || MATH_INLINE.exec(value)
    const isDisplay = !!displayMatch

    const escaped = ESCAPED_INLINE_MATH.exec(value)
    if (escaped) {
      /* istanbul ignore if - never used (yet) */
      if (silent) {
        return true
      }
      return eat(escaped[0])({
        type: 'text',
        value: '$'
      })
    }

    if (value.slice(-2) === '\\$') { // ends with \$
      return eat(value)({
        type: 'text',
        value: value.slice(0, -2) + '$'
      })
    }

    if (!match) {
      return
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
      return true
    }

    const fullMatch = match[0]
    const endingDollarInBackticks = fullMatch.includes('`') && value.slice(fullMatch.length).includes('`')
    if (endingDollarInBackticks) {
      const toEat = value.slice(0, value.indexOf('`'))
      return eat(toEat)({
        type: 'text',
        value: toEat
      })
    }

    const captured = match[1]
    const trimmedContent = captured.trim()

    if (isDisplay) {
      return eat(fullMatch)({
        type: 'math-display',
        value: trimmedContent,
        data: {
          hName: 'div',
          hProperties: {
            className: 'inlineMath inlineMathDouble math-display'
          },
          hChildren: [
            {
              type: 'text',
              value: trimmedContent
            }
          ]
        }
      })
    }

    return eat(fullMatch)({
      type: 'inlineMath', // 'math-inline',
      value: trimmedContent,
      data: {
        hName: 'span',
        hProperties: {
          className: 'inlineMath math-inline'
        },
        hChildren: [
          {
            type: 'text',
            value: trimmedContent
          }
        ]
      }
    })
  }
  inlineTokenizer.locator = locator

  const Parser = this.Parser

  // Inject inlineTokenizer
  const inlineTokenizers = Parser.prototype.inlineTokenizers
  const inlineMethods = Parser.prototype.inlineMethods
  inlineTokenizers.math = inlineTokenizer
  inlineMethods.splice(inlineMethods.indexOf('text'), 0, 'math')

  const Compiler = this.Compiler

  // Stringify for math inline
  if (Compiler != null) {
    const visitors = Compiler.prototype.visitors
    visitors.inlineMath = function (node) {
      return '$' + node.value + '$'
    }
  }
}
