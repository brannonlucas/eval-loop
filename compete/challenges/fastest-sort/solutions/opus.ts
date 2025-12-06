export function solution(arr: number[]): number[] {
  const n = arr.length;
  
  // Handle edge cases
  if (n <= 1) {
    return n === 0 ? [] : [arr[0]];
  }
  
  // Create a copy and sort in-place on the copy
  // Using slice() is one of the fastest ways to shallow copy
  const result = arr.slice();
  
  // For numeric sorting, we need a comparator
  // The subtraction comparator is fastest for numbers
  // V8's Timsort is highly optimized and hard to beat
  result.sort((a, b) => a - b);
  
  return result;
}