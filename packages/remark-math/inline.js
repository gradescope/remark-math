function locator (value, fromIndex) {
  return value.indexOf('$', fromIndex)
}

const ESCAPED_INLINE_MATH = /^\\\$/ // starts with \$

/*
const customDelimiters = {
  math: {
    left: '\\$\\$\\$',
    right: '\\$\\$\\$',
    matchInclude: ['\\\\\\$', '[^$]'],
    tagName: 'div',
    classNames: ['math', 'math-display']
  },
  inlineMath: {
    left: '\\$\\$',
    right: '\\$\\$',
    matchInclude: ['\\\\\\$', '[^$]'],
    tagName: 'span',
    classNames: ['inlineMath', 'math-inline']
  }
} */

const defaultDelimiters = {
  math: {
    left: '\\$\\$',
    right: '\\$\\$',
    matchInclude: ['\\\\\\$', '[^$]'],
    tagName: 'span',
    classNames: ['inlineMath']
  },
  inlineMath: {
    left: '\\$',
    right: '\\$',
    matchInclude: ['\\\\\\$', '[^$]'],
    tagName: 'span',
    classNames: ['inlineMath']
  }
}

function buildMatchers (delimiters) {
  return Object.keys(delimiters).reduce(function (accum, category) {
    const categoryInfo = delimiters[category]
    const left = categoryInfo.left
    const right = categoryInfo.right
    const matchInclude = categoryInfo.matchInclude
    const capture = '((?:' + matchInclude.join('|') + ')+)'
    accum[category] = new RegExp('^' + left + capture + right)
    return accum
  }, {})
}

function findMatch (matchers, value) {
  let category = null
  let match = null
  for (category in matchers) {
    const matcher = matchers[category]
    if (!matcher) {
      console.log('category', category)
      console.log('matchers', matchers)
    }
    match = matcher.exec(value)
    if (match) {
      break
    }
  }

  return match && { category, match, fullMatch: match[0], content: match[1].trim() }
}

module.exports = function inlinePlugin (opts) {
  const delimiters = (opts && opts.delimiters) || defaultDelimiters
  if (opts && opts.inlineMathDouble && delimiters.math) {
    delimiters.math.classNames.push('inlineMathDouble')
  }

  const matchers = buildMatchers(delimiters)

  function inlineTokenizer (eat, value, silent) {
    const matchData = findMatch(matchers, value)

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
        type: 'text',
        value: toEat
      })
    }

    return eat(fullMatch)({
      type: 'inlineMath',
      value: matchData.content,
      data: {
        hName: delimiters[matchData.category].tagName,
        hProperties: {
          className: delimiters[matchData.category].classNames.join(' ')
        },
        hChildren: [
          {
            type: 'text',
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
