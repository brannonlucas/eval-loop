export function solution(s: string): number {
    let index = 0;

    const parseExpression = (): number => {
        let numStack: number[] = [];
        let opStack: string[] = [];

        const applyOperator = (operator: string, b: number, a: number): number => {
            if (operator === '+') return a + b;
            if (operator === '-') return a - b;
            if (operator === '*') return a * b;
            if (operator === '/') return Math.trunc(a / b);
            return 0;
        };
        
        const precedence = (op: string): number => {
            if (op === '+' || op === '-') return 1;
            if (op === '*' || op === '/') return 2;
            return 0;
        };
        
        const higherPrecedence = (op1: string, op2: string): boolean =>
            precedence(op1) >= precedence(op2);

        const processOperator = (): void => {
            const b = numStack.pop()!;
            const a = numStack.pop()!;
            const op = opStack.pop()!;
            numStack.push(applyOperator(op, b, a));
        };

        const skipWhitespace = (): void => {
            while (index < s.length && s[index] === ' ') {
                index++;
            }
        };
        
        while (index < s.length) {
            skipWhitespace();
            
            if (index >= s.length) break;

            const char = s[index];

            if (char === '(') {
                index++;
                numStack.push(parseExpression());
                
            } else if (char === ')') {
                index++;
                break;
                
            } else if (/\d/.test(char)) {
                let num = 0;
                while (index < s.length && /\d/.test(s[index])) {
                    num = num * 10 + parseInt(s[index]);
                    index++;
                }
                numStack.push(num);
                
            } else if ('+-*/'.includes(char)) {
                while (
                    opStack.length > 0 &&
                    higherPrecedence(opStack[opStack.length - 1], char)
                ) {
                    processOperator();
                }
                opStack.push(char);
                index++;
            }
        }

        while (opStack.length > 0) {
            processOperator();
        }

        return numStack.pop()!;
    };

    return parseExpression();
}