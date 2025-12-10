export function extractCode(response: string): string {
    const FENCE = '\x60\x60\x60'; // Hex code for triple backtick

    // Helper function to trim and check for code indicators
    const isCodeIndicator = (line: string) =>
        /^\s*(import|export|const|let|var|function|class|interface|type|async|\/\/|\/\*)/.test(line);

    // Attempt to find the first code block
    let startIdx = response.indexOf(FENCE);
    if (startIdx !== -1) {
        // Increment index to the content of the code block
        startIdx += FENCE.length;

        // Find the end of the block
        const endIdx = response.indexOf(FENCE, startIdx);
        if (endIdx !== -1) {
            return response.slice(startIdx, endIdx).trim();
        }
    }

    // Raw code detection
    const lines = response.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (isCodeIndicator(lines[i])) {
            return response.slice(response.indexOf(lines[i])).trim();
        }
    }

    // Fallback to return trimmed response
    return response.trim();
}