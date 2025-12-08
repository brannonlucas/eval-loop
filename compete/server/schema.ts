/**
 * OpenAPI 3.0 Schema
 *
 * Machine-readable API specification for AI agents and tooling.
 * Served at GET /api/schema
 */

export const openApiSchema = {
  openapi: '3.0.3',
  info: {
    title: 'eval-loop API',
    description:
      'Local HTTP API for AI code competition and validation. Compare AI models, test code against challenge suites, and run generate-and-validate workflows.',
    version: '1.0.0',
    contact: {
      name: 'eval-loop',
    },
  },
  servers: [
    {
      url: 'http://localhost:3456',
      description: 'Local development server',
    },
  ],
  paths: {
    '/api/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Health check',
        description: 'Returns server status, version, uptime, and active job count.',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/schema': {
      get: {
        operationId: 'getSchema',
        summary: 'Get OpenAPI schema',
        description: 'Returns this OpenAPI 3.0 specification for machine consumption.',
        responses: {
          '200': {
            description: 'OpenAPI schema',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
    '/api/challenges': {
      get: {
        operationId: 'listChallenges',
        summary: 'List all challenges',
        description: 'Returns all available challenges including built-in and ad-hoc challenges.',
        responses: {
          '200': {
            description: 'List of challenges',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChallengesListResponse' },
              },
            },
          },
        },
      },
      post: {
        operationId: 'createChallenge',
        summary: 'Create ad-hoc challenge',
        description:
          'Create a temporary challenge from test code or an external repository path.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateChallengeRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Challenge created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateChallengeResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/challenges/{name}': {
      get: {
        operationId: 'getChallengeDetail',
        summary: 'Get challenge details',
        description: 'Returns challenge configuration, prompt text, and latest results.',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Challenge name',
          },
        ],
        responses: {
          '200': {
            description: 'Challenge details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChallengeDetailResponse' },
              },
            },
          },
          '404': {
            description: 'Challenge not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/validate': {
      post: {
        operationId: 'validateCode',
        summary: 'Validate code against challenge',
        description:
          'Test user-provided code against a challenge test suite. Optionally run benchmarks (function challenges) or Playwright performance tests (React challenges).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidateRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Validation results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidateResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/generate': {
      post: {
        operationId: 'generateCode',
        summary: 'Generate code with AI model',
        description:
          'Generate code using a single AI model without running tests. Useful for getting AI suggestions before validation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenerateRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Generated code',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenerateResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/compete': {
      post: {
        operationId: 'runCompetition',
        summary: 'Run AI model competition',
        description:
          'Run a full competition with multiple AI models. Returns Server-Sent Events (SSE) for real-time progress updates. Set stream:false for polling-based approach.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CompeteRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'SSE stream with progress events (job_created, progress, model_complete, complete, error)',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  description: 'Server-Sent Events stream',
                },
              },
              'application/json': {
                schema: { $ref: '#/components/schemas/JobCreatedResponse' },
                description: 'When stream:false, returns job ID for polling',
              },
            },
          },
        },
      },
    },
    '/api/jobs/{id}': {
      get: {
        operationId: 'getJobStatus',
        summary: 'Get job status',
        description: 'Poll job status for non-SSE clients.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Job ID',
          },
        ],
        responses: {
          '200': {
            description: 'Job status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatusResponse' },
              },
            },
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        operationId: 'cancelJob',
        summary: 'Cancel a job',
        description: 'Cancel a running or pending job.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Job ID',
          },
        ],
        responses: {
          '200': {
            description: 'Job cancelled',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cancelled: { type: 'boolean' },
                    jobId: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Cannot cancel (already completed)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/jobs/{id}/debug': {
      get: {
        operationId: 'getJobDebug',
        summary: 'Get detailed debug info for a job',
        description:
          'Returns full solutions, test outputs, prompts, and timing for each attempt. Useful for debugging why tests failed and prompt engineering. Only available for completed or failed jobs.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Job ID',
          },
          {
            name: 'model',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter results to a specific model (e.g., sonnet, opus)',
          },
        ],
        responses: {
          '200': {
            description: 'Detailed debug information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobDebugResponse' },
              },
            },
          },
          '400': {
            description: 'Job is still running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    status: { $ref: '#/components/schemas/JobStatus' },
                    progress: { type: 'object' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Job not found or no debug info available',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
        },
        required: ['error'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
          version: { type: 'string' },
          uptime: { type: 'number', description: 'Uptime in milliseconds' },
          activeJobs: { type: 'number' },
        },
      },
      ModelId: {
        type: 'string',
        enum: ['sonnet', 'opus', 'gpt4', 'gemini'],
        description: 'Available AI models',
      },
      ChallengeType: {
        type: 'string',
        enum: ['function', 'react-component'],
        description: 'Type of challenge',
      },
      ChallengeInfo: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { $ref: '#/components/schemas/ChallengeType' },
          path: { type: 'string' },
          hasResults: { type: 'boolean' },
        },
      },
      ChallengesListResponse: {
        type: 'object',
        properties: {
          challenges: {
            type: 'array',
            items: { $ref: '#/components/schemas/ChallengeInfo' },
          },
        },
      },
      ChallengeDetailResponse: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { $ref: '#/components/schemas/ChallengeType' },
          path: { type: 'string' },
          hasResults: { type: 'boolean' },
          config: {
            type: 'object',
            properties: {
              type: { $ref: '#/components/schemas/ChallengeType' },
              performanceThresholds: {
                type: 'object',
                properties: {
                  minFPS: { type: 'number' },
                  maxAvgRenderTime: { type: 'number' },
                  maxBundleSize: { type: 'number' },
                },
              },
            },
          },
          prompt: { type: 'string', description: 'Challenge prompt markdown' },
          latestResults: {
            type: 'object',
            nullable: true,
            description: 'Latest competition results if available',
          },
        },
      },
      CreateChallengeRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            pattern: '^[a-z0-9-]+$',
            description: 'Challenge name (lowercase, numbers, hyphens)',
          },
          type: { $ref: '#/components/schemas/ChallengeType' },
          prompt: { type: 'string', description: 'Challenge prompt' },
          testCode: { type: 'string', description: 'Vitest test code' },
          benchCode: { type: 'string', description: 'Optional benchmark code' },
          externalRepo: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute path to repo' },
              testPath: { type: 'string', description: 'Relative path to test file' },
              solutionPath: { type: 'string', description: 'Relative path for solution' },
            },
            description: 'Use tests from external repository',
          },
          perfConfig: {
            type: 'object',
            properties: {
              thresholds: {
                type: 'object',
                properties: {
                  minFPS: { type: 'number' },
                  maxAvgRenderTime: { type: 'number' },
                  maxBundleSize: { type: 'number' },
                },
              },
            },
          },
        },
        required: ['name', 'type', 'prompt'],
      },
      CreateChallengeResponse: {
        type: 'object',
        properties: {
          challenge: { type: 'string' },
          path: { type: 'string' },
          type: { $ref: '#/components/schemas/ChallengeType' },
        },
      },
      ValidateRequest: {
        type: 'object',
        properties: {
          challenge: { type: 'string', description: 'Challenge name' },
          code: { type: 'string', description: 'Code to validate' },
          runBenchmarks: {
            type: 'boolean',
            default: false,
            description: 'Run vitest benchmarks (function challenges)',
          },
          runPerfTests: {
            type: 'boolean',
            default: false,
            description: 'Run Playwright perf tests (React challenges)',
          },
        },
        required: ['challenge', 'code'],
      },
      ValidateResponse: {
        type: 'object',
        properties: {
          passed: { type: 'boolean' },
          testResult: {
            type: 'object',
            properties: {
              passed: { type: 'boolean' },
              errors: { type: 'array', items: { type: 'string' } },
              duration: { type: 'number' },
            },
          },
          benchmarks: {
            type: 'object',
            nullable: true,
            properties: {
              opsPerSecond: { type: 'number' },
              marginOfError: { type: 'number' },
            },
          },
          reactMetrics: {
            type: 'object',
            nullable: true,
            properties: {
              passed: { type: 'boolean' },
              fps: { type: 'number' },
              avgCommitTime: { type: 'number' },
              bundleSize: { type: 'number' },
            },
          },
        },
      },
      GenerateRequest: {
        type: 'object',
        properties: {
          model: { $ref: '#/components/schemas/ModelId' },
          challenge: { type: 'string', description: 'Challenge name' },
          prompt: { type: 'string', description: 'Custom prompt (alternative to challenge)' },
          feedback: { type: 'string', description: 'Error feedback for retry' },
        },
        required: ['model'],
      },
      GenerateResponse: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          model: { $ref: '#/components/schemas/ModelId' },
          duration: { type: 'number', description: 'Generation time in ms' },
        },
      },
      CompeteRequest: {
        type: 'object',
        properties: {
          challenge: { type: 'string', description: 'Challenge name' },
          models: {
            type: 'array',
            items: { $ref: '#/components/schemas/ModelId' },
            description: 'Models to compete (default: all)',
          },
          maxAttempts: {
            type: 'number',
            default: 3,
            description: 'Max attempts per model',
          },
          stream: {
            type: 'boolean',
            default: true,
            description: 'Use SSE streaming',
          },
          debug: {
            type: 'boolean',
            default: false,
            description: 'Save debug artifacts (solutions, vitest output)',
          },
          refinementRound: {
            type: 'boolean',
            default: false,
            description: 'Enable refinement round where models improve winning solution',
          },
        },
        required: ['challenge'],
      },
      JobStatus: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      },
      JobCreatedResponse: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          status: { $ref: '#/components/schemas/JobStatus' },
        },
      },
      JobStatusResponse: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          status: { $ref: '#/components/schemas/JobStatus' },
          progress: {
            type: 'object',
            properties: {
              currentModel: { type: 'string', nullable: true },
              currentAttempt: { type: 'number' },
              phase: { type: 'string' },
              completedModels: { type: 'array', items: { type: 'string' } },
              message: { type: 'string' },
            },
          },
          results: { type: 'array', items: { type: 'object' } },
          error: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          startedAt: { type: 'string', format: 'date-time', nullable: true },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      TestFailure: {
        type: 'object',
        description: 'Details about a single test failure',
        properties: {
          testName: { type: 'string', description: 'Name of the failing test' },
          error: { type: 'string', description: 'Error message' },
          expected: { type: 'string', nullable: true, description: 'Expected value (if assertion)' },
          received: { type: 'string', nullable: true, description: 'Received value (if assertion)' },
        },
        required: ['testName', 'error'],
      },
      ParsedTestOutput: {
        type: 'object',
        description: 'Structured test output from vitest',
        properties: {
          passed: { type: 'boolean', description: 'Whether all tests passed' },
          numTests: { type: 'number', description: 'Total number of tests' },
          numPassed: { type: 'number', description: 'Number of passing tests' },
          numFailed: { type: 'number', description: 'Number of failing tests' },
          failures: {
            type: 'array',
            items: { $ref: '#/components/schemas/TestFailure' },
            description: 'Details of each test failure',
          },
          stdout: { type: 'string', nullable: true, description: 'Full vitest stdout output' },
        },
        required: ['passed', 'numTests', 'numPassed', 'numFailed', 'failures'],
      },
      AttemptRecord: {
        type: 'object',
        description: 'Record of a single generation attempt',
        properties: {
          attemptNumber: { type: 'number', description: 'Attempt number (1-indexed)' },
          solution: { type: 'string', description: 'Generated code for this attempt' },
          testOutput: { $ref: '#/components/schemas/ParsedTestOutput' },
          prompt: { type: 'string', description: 'The prompt sent to the model' },
          feedback: {
            type: 'string',
            nullable: true,
            description: 'Error feedback from previous attempt used for retry',
          },
          duration: { type: 'number', description: 'Generation time in milliseconds' },
        },
        required: ['attemptNumber', 'solution', 'testOutput', 'prompt', 'duration'],
      },
      ModelDebugInfo: {
        type: 'object',
        description: 'Debug information for a single model',
        properties: {
          attempts: {
            type: 'array',
            items: { $ref: '#/components/schemas/AttemptRecord' },
            description: 'All attempts made by this model',
          },
          finalStatus: {
            type: 'string',
            enum: ['passed', 'failed'],
            description: 'Final outcome for this model',
          },
        },
        required: ['attempts', 'finalStatus'],
      },
      JobDebugResponse: {
        type: 'object',
        description: 'Detailed debug information for a completed job',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
          challenge: { type: 'string', description: 'Challenge name' },
          timestamp: { type: 'string', format: 'date-time', description: 'When the job was created' },
          models: {
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/ModelDebugInfo' },
            description: 'Debug info keyed by model ID',
          },
          promptMd: { type: 'string', description: 'Challenge prompt.md content' },
          config: { type: 'object', description: 'Challenge configuration' },
        },
        required: ['jobId', 'challenge', 'timestamp', 'models', 'promptMd', 'config'],
      },
    },
  },
}
