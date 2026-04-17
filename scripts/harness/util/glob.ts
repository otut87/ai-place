export function matchesGlob(path: string, pattern: string): boolean {
  const regex = globToRegex(pattern)
  return regex.test(path)
}

export function matchesAnyGlob(path: string, patterns: string[]): boolean {
  return patterns.some(p => matchesGlob(path, p))
}

function globToRegex(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*'
      i++
      if (glob[i + 1] === '/') i++
    } else if (c === '*') {
      re += '[^/]*'
    } else if (c === '?') {
      re += '[^/]'
    } else if ('.+^$()|[]{}\\'.includes(c)) {
      re += '\\' + c
    } else {
      re += c
    }
  }
  return new RegExp('^' + re + '$')
}
