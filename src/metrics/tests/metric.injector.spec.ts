import { Injectable, Module } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { Meter, metrics } from '@opentelemetry/api'
import { METRIC_METADATA, MetricType } from '../../open-telemetry.enums'
import { OpenTelemetryService } from '../../open-telemetry.service'
import { MetricInjector } from '../injectors'

// Mock service
class MockOpenTelemetryService {
  private readonly mockMeter: Meter

  constructor() {
    this.mockMeter = metrics.getMeter('default')
  }

  getMeter(): Meter {
    return this.mockMeter
  }

  collectMetrics(): string {
    return '# mock metrics'
  }

  setMetricsExporter(): void {
    // No-op for test
  }

  async beforeApplicationShutdown(): Promise<void> {
    // No-op for test
  }
}

// Test components with metric decorators
// Function to create a decorator for testing
function TestMetric(options: { name: string, description?: string }) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(METRIC_METADATA, {
      ...options,
      type: MetricType.COUNTER,
      methodName: propertyKey,
    }, descriptor.value)
    return descriptor
  }
}

@Injectable()
class TestService {
  counterCalls = 0

  @TestMetric({
    name: 'test_counter',
    description: 'Test counter for counting method calls',
  })
  countMethod(): number {
    this.counterCalls++
    return this.counterCalls
  }
}

@Module({
  providers: [TestService],
})
class TestModule {}

describe('metricInjector', () => {
  let metricInjector: MetricInjector
  let service: TestService

  beforeEach(async () => {
    // Set up the testing module
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
      providers: [
        {
          provide: OpenTelemetryService,
          useClass: MockOpenTelemetryService,
        },
        {
          provide: ModulesContainer,
          useValue: {
            // Mock the container for testing
            values: () => [
              {
                providers: new Map([
                  ['TestService', { instance: {}, metatype: TestService }],
                ]),
                controllers: new Map(),
              },
            ],
          },
        },
        MetricInjector,
      ],
    }).compile()

    metricInjector = moduleRef.get<MetricInjector>(MetricInjector)
    // Get ModulesContainer - required for injector but we don't need to use it in tests
    service = moduleRef.get<TestService>(TestService)

    // Initialize the injector
    metricInjector.inject()
  })

  it('should be defined', () => {
    expect(metricInjector).toBeDefined()
  })

  it('should inject counter into service method', () => {
    // Call the decorated method
    service.countMethod()

    // Should increment the counter
    expect(service.counterCalls).toBe(1)

    // Call again
    service.countMethod()
    expect(service.counterCalls).toBe(2)
  })
})
