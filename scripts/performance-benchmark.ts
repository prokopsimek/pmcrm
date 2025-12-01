#!/usr/bin/env ts-node

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkConfig {
  baseUrl: string;
  endpoints: EndpointConfig[];
  concurrency: number;
  iterations: number;
  warmupIterations: number;
}

interface EndpointConfig {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  target?: {
    p95: number; // milliseconds
    p99: number; // milliseconds
    errorRate: number; // percentage
  };
}

interface BenchmarkResult {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  latencies: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  throughput: {
    requestsPerSecond: number;
    mbPerSecond: number;
  };
  duration: number;
  passed: boolean;
  failures?: string[];
}

class PerformanceBenchmark {
  private client: AxiosInstance;
  private results: BenchmarkResult[] = [];

  constructor(private config: BenchmarkConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  /**
   * Run all benchmarks
   */
  async run(): Promise<void> {
    console.log('Starting performance benchmarks...\n');
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Concurrency: ${this.config.concurrency}`);
    console.log(`Iterations: ${this.config.iterations}\n`);

    for (const endpoint of this.config.endpoints) {
      await this.benchmarkEndpoint(endpoint);
    }

    this.printResults();
    this.saveResults();
  }

  /**
   * Benchmark a single endpoint
   */
  private async benchmarkEndpoint(endpoint: EndpointConfig): Promise<void> {
    console.log(`\nBenchmarking: ${endpoint.method} ${endpoint.path}`);

    // Warmup
    if (this.config.warmupIterations > 0) {
      console.log(`  Warming up (${this.config.warmupIterations} requests)...`);
      await this.executeRequests(endpoint, this.config.warmupIterations);
    }

    // Actual benchmark
    console.log(`  Running benchmark (${this.config.iterations} requests)...`);
    const startTime = Date.now();
    const responses = await this.executeRequests(endpoint, this.config.iterations);
    const duration = Date.now() - startTime;

    // Calculate metrics
    const result = this.calculateMetrics(endpoint, responses, duration);
    this.results.push(result);

    // Print immediate results
    console.log(`  ✓ Completed in ${duration}ms`);
    console.log(`    Success rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
    console.log(`    P95 latency: ${result.latencies.p95.toFixed(2)}ms`);
    console.log(`    P99 latency: ${result.latencies.p99.toFixed(2)}ms`);
    console.log(`    Throughput: ${result.throughput.requestsPerSecond.toFixed(2)} req/s`);

    if (!result.passed) {
      console.log(`    ❌ FAILED - Target not met`);
      result.failures?.forEach(failure => console.log(`       - ${failure}`));
    } else {
      console.log(`    ✅ PASSED`);
    }
  }

  /**
   * Execute concurrent requests
   */
  private async executeRequests(
    endpoint: EndpointConfig,
    count: number
  ): Promise<Array<{ latency: number; status: number; size: number; error?: string }>> {
    const results: Array<{ latency: number; status: number; size: number; error?: string }> = [];
    const batches = Math.ceil(count / this.config.concurrency);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(this.config.concurrency, count - batch * this.config.concurrency);
      const promises = Array.from({ length: batchSize }, () =>
        this.executeRequest(endpoint)
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute a single request
   */
  private async executeRequest(
    endpoint: EndpointConfig
  ): Promise<{ latency: number; status: number; size: number; error?: string }> {
    const startTime = performance.now();

    try {
      const response = await this.client.request({
        method: endpoint.method,
        url: endpoint.path,
        data: endpoint.body,
        headers: endpoint.headers,
      });

      const latency = performance.now() - startTime;
      const size = JSON.stringify(response.data).length;

      return {
        latency,
        status: response.status,
        size,
      };
    } catch (error) {
      const latency = performance.now() - startTime;
      return {
        latency,
        status: 0,
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    endpoint: EndpointConfig,
    responses: Array<{ latency: number; status: number; size: number; error?: string }>,
    duration: number
  ): BenchmarkResult {
    const latencies = responses.map(r => r.latency).sort((a, b) => a - b);
    const successful = responses.filter(r => r.status >= 200 && r.status < 300);
    const failed = responses.filter(r => r.status === 0 || r.status >= 400);

    const totalSize = responses.reduce((sum, r) => sum + r.size, 0);

    const result: BenchmarkResult = {
      endpoint: endpoint.path,
      method: endpoint.method,
      totalRequests: responses.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      errorRate: (failed.length / responses.length) * 100,
      latencies: {
        min: latencies[0] || 0,
        max: latencies[latencies.length - 1] || 0,
        mean: latencies.reduce((sum, l) => sum + l, 0) / latencies.length || 0,
        median: latencies[Math.floor(latencies.length / 2)] || 0,
        p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
        p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
        stdDev: this.calculateStdDev(latencies),
      },
      throughput: {
        requestsPerSecond: (responses.length / duration) * 1000,
        mbPerSecond: (totalSize / duration) * 1000 / (1024 * 1024),
      },
      duration,
      passed: true,
      failures: [],
    };

    // Check against targets
    if (endpoint.target) {
      if (result.latencies.p95 > endpoint.target.p95) {
        result.passed = false;
        result.failures?.push(
          `P95 latency ${result.latencies.p95.toFixed(2)}ms exceeds target ${endpoint.target.p95}ms`
        );
      }

      if (result.latencies.p99 > endpoint.target.p99) {
        result.passed = false;
        result.failures?.push(
          `P99 latency ${result.latencies.p99.toFixed(2)}ms exceeds target ${endpoint.target.p99}ms`
        );
      }

      if (result.errorRate > endpoint.target.errorRate) {
        result.passed = false;
        result.failures?.push(
          `Error rate ${result.errorRate.toFixed(2)}% exceeds target ${endpoint.target.errorRate}%`
        );
      }
    }

    return result;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Print results summary
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('BENCHMARK RESULTS SUMMARY');
    console.log('='.repeat(80) + '\n');

    const allPassed = this.results.every(r => r.passed);

    this.results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.method} ${result.endpoint}`);
      console.log(`   Requests: ${result.totalRequests} (${result.successfulRequests} success, ${result.failedRequests} failed)`);
      console.log(`   Error Rate: ${result.errorRate.toFixed(2)}%`);
      console.log(`   Latency (ms): min=${result.latencies.min.toFixed(2)} p50=${result.latencies.median.toFixed(2)} p95=${result.latencies.p95.toFixed(2)} p99=${result.latencies.p99.toFixed(2)} max=${result.latencies.max.toFixed(2)}`);
      console.log(`   Throughput: ${result.throughput.requestsPerSecond.toFixed(2)} req/s`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log(`Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Save results to file
   */
  private saveResults(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmark-results-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'benchmark-results', filename);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const output = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      summary: {
        totalEndpoints: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        avgP95: this.results.reduce((sum, r) => sum + r.latencies.p95, 0) / this.results.length,
        avgP99: this.results.reduce((sum, r) => sum + r.latencies.p99, 0) / this.results.length,
        avgThroughput: this.results.reduce((sum, r) => sum + r.throughput.requestsPerSecond, 0) / this.results.length,
      },
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`Results saved to: ${filepath}\n`);
  }
}

/**
 * Example benchmark configuration
 */
const benchmarkConfig: BenchmarkConfig = {
  baseUrl: process.env.API_URL || 'http://localhost:3000',
  concurrency: parseInt(process.env.CONCURRENCY || '10', 10),
  iterations: parseInt(process.env.ITERATIONS || '100', 10),
  warmupIterations: parseInt(process.env.WARMUP || '10', 10),
  endpoints: [
    {
      name: 'Health Check',
      method: 'GET',
      path: '/health',
      target: {
        p95: 50,
        p99: 100,
        errorRate: 0.1,
      },
    },
    {
      name: 'List Contacts',
      method: 'GET',
      path: '/api/contacts?page=1&limit=20',
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN || ''}`,
      },
      target: {
        p95: 200,
        p99: 500,
        errorRate: 0.5,
      },
    },
    {
      name: 'Search Contacts',
      method: 'GET',
      path: '/api/contacts/search?q=john',
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN || ''}`,
      },
      target: {
        p95: 100,
        p99: 200,
        errorRate: 0.5,
      },
    },
    {
      name: 'Get Contact Details',
      method: 'GET',
      path: '/api/contacts/123',
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN || ''}`,
      },
      target: {
        p95: 100,
        p99: 200,
        errorRate: 0.5,
      },
    },
    {
      name: 'Create Contact',
      method: 'POST',
      path: '/api/contacts',
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN || ''}`,
        'Content-Type': 'application/json',
      },
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: `test-${Date.now()}@example.com`,
      },
      target: {
        p95: 200,
        p99: 500,
        errorRate: 1,
      },
    },
  ],
};

// Run benchmarks
if (require.main === module) {
  const benchmark = new PerformanceBenchmark(benchmarkConfig);
  benchmark.run()
    .then(() => {
      console.log('Benchmarks completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}

export { PerformanceBenchmark, BenchmarkConfig, EndpointConfig, BenchmarkResult };
