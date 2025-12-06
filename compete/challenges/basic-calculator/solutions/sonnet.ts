export function solution(s: string): number {
    let index = 0;
    
    function skipWhitespace(): void {
        while (index < s.length && s[index] === ' ') {
            index++;
        }
    }
    
    function parseNumber(): number {
        skipWhitespace();
        let num = 0;
        while (index < s.length && s[index] >= '0' && s[index] <= '9') {
            num = num * 10 + (s.charCodeAt(index) - 48);
            index++;
        }
        return num;
    }
    
    function parseFactor(): number {
        skipWhitespace();
        if (s[index] === '(') {
            index++; // skip '('
            const result = parseExpression();
            skipWhitespace();
            index++; // skip ')'
            return result;
        }
        return parseNumber();
    }
    
    function parseTerm(): number {
        let result = parseFactor();
        
        while (true) {
            skipWhitespace();
            if (index >= s.length) break;
            
            const op = s[index];
            if (op === '*') {
                index++;
                result *= parseFactor();
            } else if (op === '/') {
                index++;
                const divisor = parseFactor();
                // Integer division truncating toward zero
                result = Math.trunc(result / divisor);
            } else {
                break;
            }
        }
        
        return result;
    }
    
    function parseExpression(): number {
        let result = parseTerm();
        
        while (true) {
            skipWhitespace();
            if (index >= s.length) break;
            
            const op = s[index];
            if (op === '+') {
                index++;
                result += parseTerm();
            } else if (op === '-') {
                index++;
                result -= parseTerm();
            } else {
                break;
            }
        }
        
        return result;
    }
    
    return parseExpression();
}