/**
 * PostgreSQL test container setup
 */
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export class PostgresContainer {
  private static container: StartedTestContainer;
  private static readonly POSTGRES_PORT = 5432;

  /**
   * Start PostgreSQL container for tests
   */
  static async start(): Promise<string> {
    console.log('Starting PostgreSQL test container...');

    this.container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'pmcrm_test',
      })
      .withExposedPorts(this.POSTGRES_PORT)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .start();

    const host = this.container.getHost();
    const port = this.container.getMappedPort(this.POSTGRES_PORT);

    const connectionString = `postgresql://test:test@${host}:${port}/pmcrm_test`;

    console.log(`PostgreSQL container started: ${connectionString}`);

    return connectionString;
  }

  /**
   * Stop PostgreSQL container
   */
  static async stop(): Promise<void> {
    if (this.container) {
      console.log('Stopping PostgreSQL test container...');
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
    const port = this.container.getMappedPort(this.POSTGRES_PORT);

    return `postgresql://test:test@${host}:${port}/pmcrm_test`;
  }
}
