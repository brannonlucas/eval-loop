export interface BenchResult {
  name: string;
  hz: number;
  mean: number;
  p75: number;
  p99: number;
}

export function parseBenchResults(output: string): BenchResult[] {
  // Pre-compiled regex to strip ANSI escape codes
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  
  // Strip ANSI escape codes from the entire output in one go
  const cleanedOutput = output.replace(ansiRegex, '');

  // Split the cleaned output into lines
  const lines = cleanedOutput.split('\n');

  // Prepare to store the benchmark results
  const results: BenchResult[] = [];

  // Iterate over each line to parse benchmark results
  for (const line of lines) {
    // Trim leading/trailing whitespace
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    // Check if line starts with a bullet point or checkmark, indicating a benchmark line
    if (trimmedLine.startsWith('·') || trimmedLine.startsWith('✓')) {
      // Split the line based on whitespace, after the first column that typically holds the name
      const parts = trimmedLine.split(/\s{2,}/);

      // Ensure we have expected number of columns
      if (parts.length >= 7) {
        // Extract the benchmark name and performance details
        const name = parts[0].substring(parts[0].indexOf(' ') + 1).trim();
        const hz = parseFloat(parts[1].replace(/,/g, '')); // Remove commas for numerical parsing
        // Parse the necessary columns converting from string to number
        const mean = parseFloat(parts[4]);
        const p75 = parseFloat(parts[5]);
        const p99 = parseFloat(parts[6]);

        // Create a BenchResult object and store it
        results.push({ name, hz, mean, p75, p99 });
      }
    } else {
      // Potential fallback parsing for older formats
      const fallbackMatch = trimmedLine.match(/^(.*) (\d+(?:,\d+)?) ops\/sec$/);
      if (fallbackMatch) {
        const name = fallbackMatch[1].trim();
        const hz = parseFloat(fallbackMatch[2].replace(/,/g, ''));
        // In older formats, mean, p75, and p99 are not present
        results.push({ name, hz, mean: 0, p75: 0, p99: 0 });
      }
    }
  }

  return results;
}