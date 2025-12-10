export function solution(arr: number[]): number[] {
    // Make a copy of the array to ensure immutability of the input
    const copiedArray = [...arr];
    
    // Sort the array using the built-in sort method
    return copiedArray.sort((a, b) => a - b);
}