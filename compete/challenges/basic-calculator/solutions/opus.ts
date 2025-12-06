export function solution(s: string): number {
  let pos = 0;
  
  function parseExpression(): number {
    let result = parseTerm();
    
    while (pos < s.length) {
      skipSpaces();
      if (pos >= s.length) break;
      
      const op = s[pos];
      if (op !== '+' && op !== '-') break;
      
      pos++;
      const term = parseTerm();
      
      if (op === '+') {
        result += term;
      } else {
        result -= term;
      }
    }
    
    return result;
  }
  
  function parseTerm(): number {
    let result = parseFactor();
    
    while (pos < s.length) {
      skipSpaces();
      if (pos >= s.length) break;
      
      const op = s[pos];
      if (op !== '*' && op !== '/') break;
      
      pos++;
      const factor = parseFactor();
      
      if (op === '*') {
        result *= factor;
      } else {
        // Truncate toward zero
        result = Math.trunc(result / factor);
      }
    }
    
    return result;
  }
  
  function parseFactor(): number {
    skipSpaces();
    
    if (s[pos] === '(') {
      pos++; // skip '('
      const result = parseExpression();
      skipSpaces();
      pos++; // skip ')'
      return result;
    }
    
    return parseNumber();
  }
  
  function parseNumber(): number {
    skipSpaces();
    let numStr = '';
    
    while (pos < s.length && s[pos] >= '0' && s[pos] <= '9') {
      numStr += s[pos];
      pos++;
    }
    
    return parseInt(numStr, 10);
  }
  
  function skipSpaces(): void {
    while (pos < s.length && s[pos] === ' ') {
      pos++;
    }
  }
  
  return parseExpression();
}