import type { BeforeApplicationShutdown } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { NodeSDK } from '@opentelemetry/sdk-node'

@Injectable()
export class OpenTelemetryService implements BeforeApplicationShutdown {
  constructor(private readonly sdk: NodeSDK) {}

  public async beforeApplicationShutdown(): Promise<void> {
    await this.sdk.shutdown()
  }
}
