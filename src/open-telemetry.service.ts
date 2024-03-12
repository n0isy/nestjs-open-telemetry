import type { BeforeApplicationShutdown } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import type { NodeSDK } from '@opentelemetry/sdk-node'

@Injectable()
export class OpenTelemetryService implements BeforeApplicationShutdown {
  constructor(private readonly sdk: NodeSDK) {}

  public async beforeApplicationShutdown(): Promise<void> {
    await this.sdk.shutdown()
  }
}
