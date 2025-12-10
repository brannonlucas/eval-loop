export function solution(arr: number[]): number[] {
    if (arr.length <= 1) return [...arr];

    // Implementing a quicksort for better average-case performance in most scenarios
    const quicksort = (arr: number[]): number[] => {
        if (arr.length < 2) return arr;

        const pivot = arr[Math.floor(arr.length / 2)];
        const left = arr.filter(x => x < pivot);
        const middle = arr.filter(x => x === pivot);
        const right = arr.filter(x => x > pivot);

        return [...quicksort(left), ...middle, ...quicksort(right)];
    };

    return quicksort(arr);
}