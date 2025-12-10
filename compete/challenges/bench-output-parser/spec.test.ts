import { describe, it, expect } from 'vitest'
import { parseBenchResults, BenchResult } from './solution'

// ANSI escape code helper
const ESC = '\x1b'
const green = (s: string) => `${ESC}[32m${s}${ESC}[39m`
const blue = (s: string) => `${ESC}[34m${s}${ESC}[39m`
const cyan = (s: string) => `${ESC}[36m${s}${ESC}[39m`
const bold = (s: string) => `${ESC}[1m${s}${ESC}[22m`
const dim = (s: string) => `${ESC}[2m${s}${ESC}[22m`

// Generate a benchmark line with ANSI codes
function benchLine(name: string, hz: number, min: number, max: number, mean: number, p75: number, p99: number): string {
  const hzStr = hz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `   ${green('·')} ${name}    ${blue(hzStr)}  ${cyan(min.toFixed(4))}  ${cyan(max.toFixed(4))}  ${cyan(mean.toFixed(4))}  ${cyan(p75.toFixed(4))}  ${cyan(p99.toFixed(4))}`
}

// Generate a clean benchmark line (no ANSI)
function cleanBenchLine(name: string, hz: number, min: number, max: number, mean: number, p75: number, p99: number): string {
  const hzStr = hz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `   · ${name}    ${hzStr}  ${min.toFixed(4)}  ${max.toFixed(4)}  ${mean.toFixed(4)}  ${p75.toFixed(4)}  ${p99.toFixed(4)}`
}

// Generate vitest bench header
function benchHeader(): string {
  return `${ESC}[1m${ESC}[46m BENCH ${ESC}[49m${ESC}[22m Summary

 ${green('✓')} spec.bench.ts${dim(' > ')}Sort Benchmarks${ESC}[33m 1234${dim('ms')}${ESC}[39m
     ${bold('name')}                      ${bold('hz')}  ${bold('   min')}  ${bold('   max')}  ${bold('  mean')}  ${bold('   p75')}  ${bold('   p99')}`
}

describe('parseBenchResults - Correctness', () => {
  describe('basic parsing', () => {
    it('parses single benchmark line with ANSI codes', () => {
      const output = benchHeader() + '\n' + benchLine('sort 1k items', 5759.18, 0.1632, 0.3222, 0.1736, 0.1735, 0.2298)
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('sort 1k items')
      expect(results[0].hz).toBeCloseTo(5759.18, 2)
      expect(results[0].mean).toBeCloseTo(0.1736, 4)
      expect(results[0].p75).toBeCloseTo(0.1735, 4)
      expect(results[0].p99).toBeCloseTo(0.2298, 4)
    })

    it('parses multiple benchmark lines', () => {
      const output = benchHeader() + '\n' +
        benchLine('sort 1k items', 5759.18, 0.1632, 0.3222, 0.1736, 0.1735, 0.2298) + '\n' +
        benchLine('sort 10k items', 523.45, 1.8234, 2.1234, 1.9102, 1.9500, 2.0800) + '\n' +
        benchLine('sort 100k items', 48.12, 19.234, 22.456, 20.789, 21.000, 21.800)

      const results = parseBenchResults(output)

      expect(results).toHaveLength(3)
      expect(results[0].name).toBe('sort 1k items')
      expect(results[1].name).toBe('sort 10k items')
      expect(results[2].name).toBe('sort 100k items')
    })

    it('parses clean lines without ANSI codes', () => {
      const output = cleanBenchLine('no ansi', 1234.56, 0.5, 1.0, 0.75, 0.8, 0.9)
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('no ansi')
      expect(results[0].hz).toBeCloseTo(1234.56, 2)
    })

    it('parses lines with checkmark marker', () => {
      const output = `   ${green('✓')} passing bench    ${blue('9,999.99')}  ${cyan('0.0100')}  ${cyan('0.0200')}  ${cyan('0.0150')}  ${cyan('0.0160')}  ${cyan('0.0180')}`
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('passing bench')
      expect(results[0].hz).toBeCloseTo(9999.99, 2)
    })
  })

  describe('number parsing', () => {
    it('handles hz with commas', () => {
      const output = cleanBenchLine('test', 1234567.89, 0.1, 0.2, 0.15, 0.16, 0.18)
      const results = parseBenchResults(output)

      expect(results[0].hz).toBeCloseTo(1234567.89, 2)
    })

    it('handles hz without decimals', () => {
      const output = `   · test    1,234  0.1000  0.2000  0.1500  0.1600  0.1800`
      const results = parseBenchResults(output)

      expect(results[0].hz).toBe(1234)
    })

    it('handles very large hz values', () => {
      const output = cleanBenchLine('fast', 99999999.99, 0.0001, 0.0002, 0.00015, 0.00016, 0.00018)
      const results = parseBenchResults(output)

      expect(results[0].hz).toBeCloseTo(99999999.99, 2)
    })

    it('handles very small hz values', () => {
      const output = cleanBenchLine('slow', 0.01, 99.0, 101.0, 100.0, 100.5, 100.9)
      const results = parseBenchResults(output)

      expect(results[0].hz).toBeCloseTo(0.01, 2)
    })
  })

  describe('benchmark names', () => {
    it('handles names with parentheses', () => {
      const output = cleanBenchLine('sort (random)', 1000, 0.1, 0.2, 0.15, 0.16, 0.18)
      const results = parseBenchResults(output)

      expect(results[0].name).toBe('sort (random)')
    })

    it('handles names with numbers', () => {
      const output = cleanBenchLine('sort 1000 items v2.0', 1000, 0.1, 0.2, 0.15, 0.16, 0.18)
      const results = parseBenchResults(output)

      expect(results[0].name).toBe('sort 1000 items v2.0')
    })

    it('handles names with special characters', () => {
      const output = cleanBenchLine('test-name_with.special:chars', 1000, 0.1, 0.2, 0.15, 0.16, 0.18)
      const results = parseBenchResults(output)

      expect(results[0].name).toBe('test-name_with.special:chars')
    })

    it('handles names with multiple spaces', () => {
      const output = cleanBenchLine('multi word bench name', 1000, 0.1, 0.2, 0.15, 0.16, 0.18)
      const results = parseBenchResults(output)

      expect(results[0].name).toBe('multi word bench name')
    })

    it('trims whitespace from names', () => {
      const output = `   · test name     1,000.00  0.1000  0.2000  0.1500  0.1600  0.1800`
      const results = parseBenchResults(output)

      expect(results[0].name).toBe('test name')
    })
  })

  describe('fallback format (ops/sec)', () => {
    it('parses simple ops/sec format', () => {
      const output = 'benchmark name  1,234 ops/sec'
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('benchmark name')
      expect(results[0].hz).toBe(1234)
      expect(results[0].mean).toBe(0)
      expect(results[0].p75).toBe(0)
      expect(results[0].p99).toBe(0)
    })

    it('parses ops/sec without commas', () => {
      const output = 'simple test  999 ops/sec'
      const results = parseBenchResults(output)

      expect(results[0].hz).toBe(999)
    })

    it('parses mixed formats', () => {
      const output = cleanBenchLine('full format', 5000, 0.1, 0.2, 0.15, 0.16, 0.18) + '\n' +
        'simple format  2,500 ops/sec'
      const results = parseBenchResults(output)

      expect(results).toHaveLength(2)
      expect(results[0].hz).toBeCloseTo(5000, 0)
      expect(results[1].hz).toBe(2500)
    })
  })

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseBenchResults('')).toEqual([])
    })

    it('returns empty array for whitespace only', () => {
      expect(parseBenchResults('   \n  \n   ')).toEqual([])
    })

    it('returns empty array for no benchmark lines', () => {
      const output = `${ESC}[1m BENCH ${ESC}[22m Summary\n\nNo benchmarks found.\n`
      expect(parseBenchResults(output)).toEqual([])
    })

    it('ignores header lines', () => {
      const output = benchHeader() + '\n' + benchLine('actual bench', 1000, 0.1, 0.2, 0.15, 0.16, 0.18)
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('actual bench')
    })

    it('ignores malformed lines', () => {
      const output = `
   · incomplete line
   · another incomplete 123
   ${cleanBenchLine('valid', 1000, 0.1, 0.2, 0.15, 0.16, 0.18)}
   random text here
      `
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('valid')
    })

    it('handles Windows line endings', () => {
      const output = cleanBenchLine('test1', 1000, 0.1, 0.2, 0.15, 0.16, 0.18) + '\r\n' +
        cleanBenchLine('test2', 2000, 0.1, 0.2, 0.15, 0.16, 0.18)
      const results = parseBenchResults(output)

      expect(results).toHaveLength(2)
    })

    it('handles lines with extra columns', () => {
      const output = `   · test    1,000.00  0.1000  0.2000  0.1500  0.1600  0.1800  0.1900  0.1950  extra`
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].p99).toBeCloseTo(0.18, 4)
    })
  })

  describe('ANSI code handling', () => {
    it('strips various ANSI codes', () => {
      const output = `${ESC}[0m${ESC}[1m${ESC}[31m${ESC}[42m   · colored test    ${ESC}[34m1,000.00${ESC}[0m  0.1000  0.2000  0.1500  0.1600  0.1800`
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('colored test')
    })

    it('handles codes with multiple parameters', () => {
      const output = `${ESC}[38;5;196m   · rgb test    ${ESC}[0m1,000.00  0.1000  0.2000  0.1500  0.1600  0.1800`
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('rgb test')
    })

    it('handles nested ANSI codes', () => {
      const output = `${ESC}[1m${ESC}[32m   · ${ESC}[33mnested${ESC}[32m test${ESC}[0m    1,000.00  0.1000  0.2000  0.1500  0.1600  0.1800`
      const results = parseBenchResults(output)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('nested test')
    })
  })

  describe('real-world output patterns', () => {
    it('parses realistic vitest bench output', () => {
      const output = `${ESC}[33mBenchmarking is an experimental feature.${ESC}[39m

${ESC}[1m${ESC}[46m RUN ${ESC}[49m${ESC}[22m ${ESC}[36mv4.0.15 ${ESC}[39m${ESC}[90m/project${ESC}[39m


 ${ESC}[32m✓${ESC}[39m spec.bench.ts${ESC}[2m > ${ESC}[22mextractCode - Typed Blocks${ESC}[33m 4510${ESC}[2mms${ESC}[22m${ESC}[39m
     ${ESC}[1mname                          ${ESC}[22m  ${ESC}[1m           hz${ESC}[22m  ${ESC}[1m   min${ESC}[22m  ${ESC}[1m   max${ESC}[22m  ${ESC}[1m  mean${ESC}[22m  ${ESC}[1m   p75${ESC}[22m  ${ESC}[1m   p99${ESC}[22m
   ${ESC}[32m·${ESC}[39m small typed block (10 lines)    ${ESC}[34m10,176,859.00${ESC}[39m  ${ESC}[36m0.0000${ESC}[39m  ${ESC}[36m3.6884${ESC}[39m  ${ESC}[36m0.0001${ESC}[39m  ${ESC}[36m0.0001${ESC}[39m  ${ESC}[36m0.0002${ESC}[39m
   ${ESC}[32m·${ESC}[39m medium typed block (100 lines)  ${ESC}[34m 6,877,120.45${ESC}[39m  ${ESC}[36m0.0000${ESC}[39m  ${ESC}[36m0.0304${ESC}[39m  ${ESC}[36m0.0001${ESC}[39m  ${ESC}[36m0.0002${ESC}[39m  ${ESC}[36m0.0003${ESC}[39m
   ${ESC}[32m·${ESC}[39m large typed block (500 lines)   ${ESC}[34m 3,018,431.96${ESC}[39m  ${ESC}[36m0.0002${ESC}[39m  ${ESC}[36m0.0285${ESC}[39m  ${ESC}[36m0.0003${ESC}[39m  ${ESC}[36m0.0003${ESC}[39m  ${ESC}[36m0.0006${ESC}[39m`

      const results = parseBenchResults(output)

      expect(results).toHaveLength(3)
      expect(results[0].name).toBe('small typed block (10 lines)')
      expect(results[0].hz).toBeCloseTo(10176859, 0)
      expect(results[1].name).toBe('medium typed block (100 lines)')
      expect(results[2].name).toBe('large typed block (500 lines)')
    })

    it('parses output with summary section', () => {
      const output = benchHeader() + '\n' +
        benchLine('bench1', 1000, 0.1, 0.2, 0.15, 0.16, 0.18) + '\n' +
        benchLine('bench2', 2000, 0.05, 0.1, 0.075, 0.08, 0.09) + '\n' +
        `\n${ESC}[1m${ESC}[46m BENCH ${ESC}[49m${ESC}[22m${ESC}[36mSummary${ESC}[39m\n\n` +
        `  bench1 - spec.bench.ts\n` +
        `${ESC}[32m    2.00x ${ESC}[39m${ESC}[90mfaster than ${ESC}[39mbench2\n`

      const results = parseBenchResults(output)

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe('bench1')
      expect(results[1].name).toBe('bench2')
    })
  })
})

// Generate test data for benchmarks
export function generateBenchOutput(count: number, withAnsi: boolean = true): string {
  const lines: string[] = []

  // Add header
  if (withAnsi) {
    lines.push(`${ESC}[1m${ESC}[46m BENCH ${ESC}[49m${ESC}[22m Summary`)
    lines.push('')
    lines.push(` ${ESC}[32m✓${ESC}[39m spec.bench.ts${ESC}[2m > ${ESC}[22mBenchmarks${ESC}[33m 1234${ESC}[2mms${ESC}[22m${ESC}[39m`)
    lines.push(`     ${ESC}[1mname${ESC}[22m                      ${ESC}[1mhz${ESC}[22m  ${ESC}[1m   min${ESC}[22m  ${ESC}[1m   max${ESC}[22m  ${ESC}[1m  mean${ESC}[22m  ${ESC}[1m   p75${ESC}[22m  ${ESC}[1m   p99${ESC}[22m`)
  } else {
    lines.push(' BENCH  Summary')
    lines.push('')
    lines.push(' ✓ spec.bench.ts > Benchmarks 1234ms')
    lines.push('     name                      hz     min    max   mean    p75    p99')
  }

  // Add benchmark lines
  for (let i = 0; i < count; i++) {
    const name = `benchmark ${i + 1} (test case)`
    const hz = Math.random() * 10000000 + 1000
    const min = Math.random() * 0.1
    const max = min + Math.random() * 0.2
    const mean = (min + max) / 2
    const p75 = min + (max - min) * 0.75
    const p99 = min + (max - min) * 0.99

    if (withAnsi) {
      lines.push(benchLine(name, hz, min, max, mean, p75, p99))
    } else {
      lines.push(cleanBenchLine(name, hz, min, max, mean, p75, p99))
    }
  }

  return lines.join('\n')
}
