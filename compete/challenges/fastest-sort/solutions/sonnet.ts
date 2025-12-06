export function solution(arr: number[]): number[] {
    return [...arr].sort((a, b) => a - b);
}