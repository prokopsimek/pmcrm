/**
 * Redis test container setup for BullMQ and caching tests
 */
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export class RedisContainer {
  private static container: StartedTestContainer;
  private static readonly REDIS_PORT = 6379;

  /**
   * Start Redis container for tests
   */
  static async start(): Promise<string> {
    console.log('Starting Redis test container...');

    this.container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(this.REDIS_PORT)
      .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
      .start();

    const host = this.container.getHost();
    const port = this.container.getMappedPort(this.REDIS_PORT);

    const connectionString = `redis://${host}:${port}`;

    console.log(`Redis container started: ${connectionString}`);

    return connectionString;
  }

  /**
   * Stop Redis container
   */
  static async stop(): Promise<void> {
    if (this.container) {
      console.log('Stopping Redis test container...');
      await this.container.stop();
    }
  }

  /**
   * Get connection string
   */
  static getConnectionString(): string {
    if (!this.container) {
      throw new Error('Container not started');
    }

    const host = this.container.getHost();
    const port = this.container.getMappedPort(this.REDIS_PORT);

    return `redis://${host}:${port}`;
  }
}
