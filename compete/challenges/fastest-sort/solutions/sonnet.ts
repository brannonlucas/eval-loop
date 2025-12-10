export function solution(arr: number[]): number[] {
  return arr.slice().sort((a, b) => a - b);
}