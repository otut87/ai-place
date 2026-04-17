const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

export const log = {
  title(msg: string): void {
    console.log(`\n${COLORS.bold}${COLORS.cyan}▶ ${msg}${COLORS.reset}`)
  },
  pass(msg: string): void {
    console.log(`  ${COLORS.green}✓${COLORS.reset} ${msg}`)
  },
  fail(msg: string): void {
    console.log(`  ${COLORS.red}✗${COLORS.reset} ${msg}`)
  },
  warn(msg: string): void {
    console.log(`  ${COLORS.yellow}⚠${COLORS.reset} ${msg}`)
  },
  info(msg: string): void {
    console.log(`  ${COLORS.gray}${msg}${COLORS.reset}`)
  },
  error(msg: string): void {
    console.error(`${COLORS.red}${COLORS.bold}ERROR:${COLORS.reset} ${msg}`)
  },
  section(msg: string): void {
    console.log(`\n${COLORS.bold}${msg}${COLORS.reset}`)
  },
}
