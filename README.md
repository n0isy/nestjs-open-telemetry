<p align="center">
  <img width="450" alt="NestJS OpenTelemetry logo" src="https://raw.githubusercontent.com/Yuuki-Sakura/Nestjs-OpenTelemetry/main/docs/logo.png"/>
</p>

<h1 align="center">NestJS OpenTelemetry</h1>
<p align="center">
<a href="https://www.npmjs.com/package/@n0isy/nestjs-open-telemetry"><img src="https://img.shields.io/npm/v/@n0isy/nestjs-open-telemetry.svg"/> <img src="https://img.shields.io/npm/dt/@n0isy/nestjs-open-telemetry.svg"/></a>
<a href="https://github.com/n0isy/nestjs-open-telemetry"><img src="https://img.shields.io/npm/l/@n0isy/nestjs-open-telemetry.svg"/></a>
<a href="https://github.com/n0isy/nestjs-open-telemetry"><img src="https://img.shields.io/github/stars/n0isy/nestjs-open-telemetry.svg"/></a>
</p>

This library provides deeply integrated protocol-agnostic Nestjs [OpenTelemetry](https://opentelemetry.io/) instrumentations, metrics and SDK.

### Description

Nestjs is a protocol-agnostic framework. That's why this library can able to work with different protocols like RabbitMQ, GRPC and HTTP. Also you can observe and trace Nestjs specific layers like [Pipe](https://docs.nestjs.com/pipes), [Guard](https://docs.nestjs.com/guards), [Controller](https://docs.nestjs.com/controllers) and [Provider](https://docs.nestjs.com/providers).

It also includes auto trace and metric instrumentations for some popular Nestjs libraries.

- #### Distributed Tracing
  - [Setup](#distributed-tracing-1)
  - [Decorators](#trace-decorators)
  - [Trace Providers](#trace-providers)
  - [Auto Trace Instrumentations](#auto-trace-instrumentations)

- #### Metrics (New in 1.3.0)
  - [Setup](#metrics-setup)
  - [Metric Decorators](#metric-decorators)
  - [HTTP Metrics](#http-metrics)
  - [Custom Metrics](#custom-metrics)

Supports NestJS 9.x and 10.x

### Installation
``` bash
npm install @n0isy/nestjs-open-telemetry --save
```
***
### Configuration
This is a basic configuration without any trace and metric exporter, but includes default metrics and injectors
```ts
import { OpenTelemetryModule } from '@n0isy/nestjs-open-telemetry'

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      serviceName: 'nestjs-opentelemetry-example',
      metrics: {
        enabled: true,         // Enable metrics collection
        controller: true,      // Enable metrics endpoint (/metrics by default)
        endpoint: '/metrics',  // Customize metrics endpoint path
        prefix: 'app_',        // Add prefix to all metrics
      }
    })
  ]
})
export class AppModule {}
```

Async configuration example (Not recommended, May cause auto instrumentations to not work)
```ts
import { OpenTelemetryModule } from '@n0isy/nestjs-open-telemetry'
import { ConfigModule, ConfigService } from '@nestjs/config'

@Module({
  imports: [
    OpenTelemetryModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        serviceName: configService.get('SERVICE_NAME'),
      }),
      inject: [ConfigService]
    })
  ]
})
export class AppModule {}
```
#### Default Parameters
| key               | value                                                                                                                                                                                                     | description                                                                                                                                                                                                                                                               |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| traceInjectors    | DecoratorInjector, ScheduleInjector, ControllerInjector, GuardInjector, PipeInjector, InterceptorInjector, ExceptionFilterInjector, TypeormInjector, LoggerInjector, ProviderInjector, MiddlewareInjector | default auto trace instrumentations                                                                                                                                                                                                                                       |
| contextManager    | AsyncLocalStorageContextManager                                                                                                                                                                           | default trace context manager inherited from <a href="https://github.com/open-telemetry/opentelemetry-js/blob/745bd5c34d3961dc73873190adc763747e5e026d/experimental/packages/opentelemetry-sdk-node/src/types.ts#:~:text=NodeSDKConfiguration"> NodeSDKConfiguration </a> |
| instrumentations  | AutoInstrumentations                                                                                                                                                                                      | default instrumentations inherited from <a href="https://github.com/open-telemetry/opentelemetry-js/blob/745bd5c34d3961dc73873190adc763747e5e026d/experimental/packages/opentelemetry-sdk-node/src/types.ts#:~:text=NodeSDKConfiguration"> NodeSDKConfiguration </a>      |
| textMapPropagator | W3CTraceContextPropagator                                                                                                                                                                                 | default textMapPropagator inherited from <a href="https://github.com/open-telemetry/opentelemetry-js/blob/745bd5c34d3961dc73873190adc763747e5e026d/experimental/packages/opentelemetry-sdk-node/src/types.ts#:~:text=NodeSDKConfiguration"> NodeSDKConfiguration </a>     |

`OpenTelemetryModule.forRoot()` takes [OpenTelemetryModuleConfig](https://github.com/MetinSeylan/Nestjs-OpenTelemetry/blob/main/src/OpenTelemetryModuleConfig.ts#L25) as a parameter, this type is inherited by [NodeSDKConfiguration](https://github.com/open-telemetry/opentelemetry-js/blob/745bd5c34d3961dc73873190adc763747e5e026d/experimental/packages/opentelemetry-sdk-node/src/types.ts#:~:text=NodeSDKConfiguration) so you can use same OpenTelemetry SDK parameter.
***
### Distributed Tracing
Simple setup with Zipkin exporter, including with default trace instrumentations.
```ts
import { OpenTelemetryModule } from '@n0isy/nestjs-open-telemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      spanProcessor: new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: 'http://<collector-hostname>:<port>',
        })
      ),
    }),
  ],
})
export class AppModule {}
```
After setup, your application will be instrumented, so that you can see almost every layer of application in ZipkinUI, including Guards, Pipes, Controllers even global layers like this

![Example trace output](./docs/trace-flow.jpeg)

List of supported official exporters [here](https://opentelemetry.io/docs/js/exporters/).
***
#### Trace Decorators
This library supports auto instrumentations for Nestjs layers, but sometimes you need to define custom span for specific method blocks like providers methods. In this case `@Trace` and `@TracePlain` decorator will help you.
```ts
import { Injectable } from '@nestjs/common'
import { Trace } from '@n0isy/nestjs-open-telemetry'

@Injectable()
export class AppService {
  @Trace()
  getHello(): string {
    return 'Hello World!'
  }
}
```
Also `@Trace` decorator takes `name` field as a parameter
```ts
@Trace({ name: 'hello' })
```

***
#### Trace Providers
In an advanced usage case, you need to access the native OpenTelemetry Trace provider to access them from Nestjs application context.
```ts
import { Injectable } from '@nestjs/common'
import { Tracer } from '@opentelemetry/sdk-trace-base'

@Injectable()
export class AppService {
  constructor() {}

  getHello(): string {
    const span = trace.getTracer('default').startSpan('important_section_start')
    // do something important
    span.setAttributes({ userId: 1150 })
    span.end()
    return 'Hello World!'
  }
}
```
***
#### Auto Trace Instrumentations
The most helpful part of this library is that you already get all of the instrumentations by default if you set up a module without any extra configuration. If you need to avoid some of them, you can use the `traceAutoInjectors` parameter.
```ts
import { Module } from '@nestjs/common'
import {
  ControllerInjector,
  EventEmitterInjector,
  GuardInjector,
  LoggerInjector,
  OpenTelemetryModule,
  PipeInjector,
  ScheduleInjector,
} from '@n0isy/nestjs-open-telemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      traceInjectors: [
        ControllerInjector,
        GuardInjector,
        EventEmitterInjector,
        ScheduleInjector,
        PipeInjector,
        LoggerInjector,
      ],
      spanProcessor: new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: 'http://<collector-hostname>:<port>',
        })
      ),
    }),
  ]
})
export class AppModule {}
```

#### List of Trace Injectors
| Instance                  | Description                                                                                                          |
|---------------------------|----------------------------------------------------------------------------------------------------------------------|
| `ControllerInjector`      | Auto trace all of module controllers                                                                                 |
| `DecoratorInjector`       | Auto trace all of decorator providers                                                                                |
| `GuardInjector`           | Auto trace all of module guards including global guards                                                              |
| `PipeInjector`            | Auto trace all of module pipes including global pipes                                                                |
| `InterceptorInjector`     | Auto trace all of module interceptors including global interceptors                                                  |
| `ExceptionFilterInjector` | Auto trace all of module exceptionFilters including global exceptionFilters                                          |
| `MiddlewareInjector`      | Auto trace all of module middlewares including global middlewares                                                    |
| `ProviderInjector`        | Auto trace all of module providers                                                                                   |
| `ScheduleInjector`        | Auto trace for [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling) library, supports all features |
| `LoggerInjector`          | [Logger](https://docs.nestjs.com/techniques/logger#using-the-logger-for-application-logging) class tracer            |
| `TypeormInjector`         | Auto trace for [typeorm](https://github.com/typeorm/typeorm) library                                                 |
| `MetricInjector`          | Auto inject metrics for decorated methods (new in 1.3.0)                                                             |
***

### Metrics Setup
OpenTelemetry Metrics are now fully supported (as of v1.3.0). The module provides a comprehensive metrics solution that works with both Express and Fastify backends.

```ts
import { OpenTelemetryModule } from '@n0isy/nestjs-open-telemetry'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      serviceName: 'my-service',
      metrics: {
        enabled: true,                // Enable metrics collection
        controller: true,             // Enable /metrics endpoint
        endpoint: '/metrics',         // Custom endpoint path (default is /metrics)
        prefix: 'app_',               // Prefix for all metrics
        defaultLabels: {              // Default labels for all metrics
          environment: 'production',
        },
        // Optional authentication function
        authentication: (req) => {
          return req.headers['x-api-key'] === 'secret-key'
        },
      }
    })
  ]
})
export class AppModule {}
```

The metrics are exposed in Prometheus format at the `/metrics` endpoint (or custom path). The PrometheusExporter from OpenTelemetry is used for formatting but without starting a separate HTTP server.

#### Metric Decorators

The library provides several decorators for metrics:

```ts
import { Injectable } from '@nestjs/common'
import { Counter, Histogram, UpDownCounter, ObservableGauge } from '@n0isy/nestjs-open-telemetry'

@Injectable()
export class UserService {
  private activeUsers = 0;

  // Count method calls
  @Counter({
    name: 'user_login_total',
    description: 'Total number of user logins',
    attributes: { service: 'user-service' },
  })
  login(userId: string): void {
    // Method will be counted on each call
    this.activeUsers++;
    // Implementation...
  }

  // Measure duration of method execution
  @Histogram({
    name: 'user_search_duration_ms',
    description: 'Search operation duration in milliseconds',
    unit: 'ms',
  })
  async searchUsers(query: string): Promise<User[]> {
    // Method duration will be automatically measured
    const result = await this.userRepository.search(query);
    return result;
  }

  // Track values that go up and down
  @UpDownCounter({
    name: 'active_users',
    description: 'Number of currently active users',
    attributes: { region: 'us-east' },
  })
  userSessionChange(delta: number): void {
    // The delta value will be added to the counter
    this.activeUsers += delta;
    // Implementation...
  }

  // Observe current values
  @ObservableGauge({
    name: 'memory_usage_bytes',
    description: 'Current memory usage in bytes',
    unit: 'bytes',
  })
  getMemoryUsage(): number {
    // Return value will be recorded as a gauge metric
    return process.memoryUsage().heapUsed;
  }
}
```

#### HTTP Metrics

The module automatically collects HTTP metrics using a universal middleware that works with both Express and Fastify. These metrics include:

- Request counts by route, method, and status code
- Request duration in milliseconds
- Request and response sizes in bytes

#### Custom Metrics

You can also create custom metrics directly using the OpenTelemetryService:

```ts
import { Injectable } from '@nestjs/common'
import { OpenTelemetryService } from '@n0isy/nestjs-open-telemetry'

@Injectable()
export class CustomMetricsService {
  // Counters
  private readonly requestCounter;
  // Histograms 
  private readonly requestDurationHistogram;

  constructor(private readonly openTelemetryService: OpenTelemetryService) {
    // Create metrics
    this.requestCounter = this.openTelemetryService.createCounter(
      'custom_requests_total',
      { description: 'Total custom requests' }
    );
    
    this.requestDurationHistogram = this.openTelemetryService.createHistogram(
      'custom_request_duration_ms',
      { description: 'Request duration in ms', unit: 'ms' }
    );
  }

  trackRequest(path: string, status: number, duration: number): void {
    const attributes = { 
      path, 
      status: status.toString() 
    };
    
    // Increment counter with attributes
    this.requestCounter.add(1, attributes);
    
    // Record duration in histogram
    this.requestDurationHistogram.record(duration, attributes);
  }
}
```

To view metrics, access the `/metrics` endpoint of your application. The metrics are provided in Prometheus format and can be scraped by Prometheus server or any compatible monitoring system.
***
