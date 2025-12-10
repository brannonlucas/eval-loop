export function solution(arr: number[]): number[] {
    const len = arr.length;
    if (len <= 1) return arr.slice();
    
    // Use different strategies based on array size
    if (len < 50) {
        // Insertion sort for small arrays
        const result = new Array(len);
        for (let i = 0; i < len; i++) {
            result[i] = arr[i];
        }
        
        for (let i = 1; i < len; i++) {
            const key = result[i];
            let j = i - 1;
            while (j >= 0 && result[j] > key) {
                result[j + 1] = result[j];
                j--;
            }
            result[j + 1] = key;
        }
        return result;
    }
    
    // Quick sort for larger arrays
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = arr[i];
    }
    
    function quickSort(low: number, high: number): void {
        if (low < high) {
            const pi = partition(low, high);
            quickSort(low, pi - 1);
            quickSort(pi + 1, high);
        }
    }
    
    function partition(low: number, high: number): number {
        const pivot = result[high];
        let i = low - 1;
        
        for (let j = low; j < high; j++) {
            if (result[j] <= pivot) {
                i++;
                const temp = result[i];
                result[i] = result[j];
                result[j] = temp;
            }
        }
        
        const temp = result[i + 1];
        result[i + 1] = result[high];
        result[high] = temp;
        
        return i + 1;
    }
    
    quickSort(0, len - 1);
    return result;
}