function locator (value, fromIndex) {
  return value.indexOf('$', fromIndex)
}

const ESCAPED_INLINE_MATH = /^\\\$/ // starts with \$

const NODE_TYPES = {
  TEXT: 'text',
  MATH_DISPLAY: 'math',
  MATH_INLINE: 'inlineMath'
}

const defaultModes = {
  mathInlineDouble: {
    nodeType: NODE_TYPES.MATH_INLINE,
    left: /\$\$/,
    right: /\$\$/,
    matchInclude: [/\\\$/, /[^$]/],
    tagName: 'span',
    getClassNames: function (opts) {
      return opts && opts.inlineMathDouble ? ['inlineMath', 'inlineMathDouble'] : ['inlineMath']
    }
  },
  mathInline: {
    nodeType: NODE_TYPES.MATH_INLINE,
    left: /\$/,
    right: /\$/,
    matchInclude: [/\\\$/, /[^$]/],
    tagName: 'span',
    getClassNames: function () { return ['inlineMath'] }
  }
}

function buildMatchers (modes) {
  return Object.keys(modes).reduce(function (accum, modeName) {
    const mode = modes[modeName]
    const left = mode.left.source
    const right = mode.right.source
    const matchInclude = mode.matchInclude.map(function (s) { return s.source })
    const capture = '((?:' + matchInclude.join('|') + ')+)'
    accum[modeName] = new RegExp('^' + left + capture + right)
    return accum
  }, {})
}

function findMatch (matchers, value) {
  let modeName = null
  let match = null
  for (modeName in matchers) {
    const matcher = matchers[modeName]
    match = matcher.exec(value)
    if (match) {
      break
    }
  }

  return match && { modeName, match, fullMatch: match[0], content: match[1].trim() }
}

module.exports = function inlinePlugin (opts) {
  const modes = (opts && opts.modes) || defaultModes

  const matchers = buildMatchers(modes)

  function inlineTokenizer (eat, value, silent) {
    const matchData = findMatch(matchers, value)

    const escaped = ESCAPED_INLINE_MATH.exec(value)
    if (escaped) {
      /* istanbul ignore if - never used (yet) */
      if (silent) {
        return true
      }
      return eat(escaped[0])({
        type: NODE_TYPES.TEXT,
        value: '$'
      })
    }

    if (value.slice(-2) === '\\$') { // ends with \$
      return eat(value)({
        type: NODE_TYPES.TEXT,
        value: value.slice(0, -2) + '$'
      })
    }

    if (!matchData) {
      return
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
      return true
    }

    const fullMatch = matchData.fullMatch
    const endingDollarInBackticks = fullMatch.includes('`') && value.slice(fullMatch.length).includes('`')
    if (endingDollarInBackticks) {
      const toEat = value.slice(0, value.indexOf('`'))
      return eat(toEat)({
        type: NODE_TYPES.TEXT,
        value: toEat
      })
    }

    const mode = modes[matchData.modeName]
    return eat(fullMatch)({
      type: mode.nodeType,
      value: matchData.content,
      data: {
        hName: mode.tagName,
        hProperties: {
          className: mode.getClassNames(opts).join(' ')
        },
        hChildren: [
          {
            type: NODE_TYPES.TEXT,
            value: matchData.content
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
  inlineTokenizers[NODE_TYPES.MATH_DISPLAY] = inlineTokenizer
  inlineMethods.splice(inlineMethods.indexOf(NODE_TYPES.TEXT), 0, NODE_TYPES.MATH_DISPLAY)

  const Compiler = this.Compiler

  // Stringify for math inline
  if (Compiler != null) {
    const visitors = Compiler.prototype.visitors
    visitors[NODE_TYPES.MATH_INLINE] = function (node) {
      return '$' + node.value + '$'
    }
  }
}
