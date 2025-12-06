export function solution(arr: number[]): number[] {
    // Create a shallow copy of the array to avoid mutating the input array
    const copiedArray = arr.slice();
    // Sort the copied array using the built-in sort method with a comparator for numeric sorting
    copiedArray.sort((a, b) => a - b);
    // Return the sorted copy
    return copiedArray;
}