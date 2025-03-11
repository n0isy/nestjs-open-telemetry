# NestJS OpenTelemetry Project Guidelines

## Build and Test Commands
- Build: `pnpm build` (rimraf dist && nest build)
- Lint: `pnpm lint` (eslint --fix)
- Test all: `pnpm test`
- Test specific file: `pnpm test -- src/trace/tests/file.spec.ts`
- Test specific pattern: `pnpm test -- -t "test description"`
- Test with coverage: `pnpm test:cov`
- Test in watch mode: `pnpm test:watch`
- Publish to npmjs: `pnpm publish:n0isy` (with --no-git-checks flag)
- For OTP-protected accounts: `pnpm publish:n0isy --otp=XXXXXX`

## Code Style Guidelines
- TypeScript with strict type checking (noImplicitAny, strictNullChecks, etc.)
- Use single quotes for strings
- 2-space indentation
- Type imports separated: `import type { Type } from '@package'`
- Regular imports: `import { Class } from '@package'`
- Class properties defined at the top, followed by constructor, then methods
- Prefer arrow functions for callbacks
- Export patterns through index.ts files
- Use decorators for NestJS patterns
- Error handling: exceptions should be properly captured and recorded in spans
- Use descriptive naming: full words over abbreviations (controller vs ctrl)

## Architecture Patterns
- Follow NestJS module architecture
- Use dependency injection with constructor injection
- Maintain clean separation between injectors and decorators

## Codebase Structure

### Module

#### OpenTelemetryModule

**Purpose**: Core module for integrating OpenTelemetry into NestJS applications.

**Key Methods**:
- `configure(consumer: MiddlewareConsumer)`: Applies HTTP metrics middleware to all routes.
- `forRoot(config: Partial<OpenTelemetryModuleConfig>)`: Static method for synchronous configuration.
- `forRootAsync(configuration: OpenTelemetryModuleAsyncOption)`: Static method for asynchronous configuration.

**Private Methods**:
- `buildProvider(configuration)`: Creates NodeSDK value provider
- `buildInjectors(configuration)`: Creates factory provider for trace injectors
- `buildAsyncProvider()`: Creates factory provider for async NodeSDK initialization
- `buildAsyncInjectors()`: Creates factory provider for async injector initialization

### Service

#### OpenTelemetryService

**Purpose**: Provides an interface to OpenTelemetry APIs including tracer and metrics.

**Properties**:
- `meter: Meter`: OpenTelemetry meter for creating metrics
- `metricsExporter: PrometheusExporterInterface | null`: Prometheus exporter for metrics

**Key Methods**:
- `setMetricsExporter(exporter: PrometheusExporterInterface)`: Sets the metrics exporter
- `getMeter()`: Returns the OpenTelemetry meter
- `createCounter(name, options)`: Creates a counter metric
- `createHistogram(name, options)`: Creates a histogram metric
- `createUpDownCounter(name, options)`: Creates an up-down counter metric
- `createObservableGauge(name, options)`: Creates an observable gauge metric
- `collectMetrics()`: Collects and formats metrics from the meter in Prometheus format
- `beforeApplicationShutdown()`: Gracefully shuts down the OpenTelemetry SDK

### Metrics

#### Decorators

##### @Metric
**Purpose**: Base decorator for instrumenting methods with metrics.
**Parameters**: `options: MetricDecoratorOptions`: Configuration including name, type, and description

##### @Counter
**Purpose**: Shorthand decorator for creating counter metrics.
**Parameters**: `options: Omit<MetricDecoratorOptions, 'type'>`: Counter configuration without type

##### @Histogram
**Purpose**: Shorthand decorator for creating histogram metrics.
**Parameters**: `options: Omit<MetricDecoratorOptions, 'type'>`: Histogram configuration without type

##### @UpDownCounter
**Purpose**: Shorthand decorator for creating up-down counter metrics.
**Parameters**: `options: Omit<MetricDecoratorOptions, 'type'>`: Up-down counter configuration without type

##### @ObservableGauge
**Purpose**: Shorthand decorator for creating observable gauge metrics.
**Parameters**: `options: Omit<MetricDecoratorOptions, 'type'>`: Observable gauge configuration without type

#### Classes

##### MetricInjector
**Purpose**: Processes classes to inject metric collection logic.
**Constructor Parameters**:
- `modulesContainer: ModulesContainer`: NestJS modules container
- `openTelemetryService: OpenTelemetryService`: Service for accessing OpenTelemetry APIs

**Key Methods**:
- `inject()`: Processes all controllers and providers to inject metric collection
- `processClass(instance, options)`: Processes a class instance to find metric decorations
- `wrapWithMetric(methodRef, metricOptions, contextInfo)`: Wraps methods with metric collection logic
- `createMetric(options)`: Creates different types of metrics based on options

##### UniversalHttpMetricsMiddleware
**Purpose**: Collects HTTP metrics for requests and responses.
**Properties**:
- `requestCounter`: Counts total HTTP requests
- `requestDurationHistogram`: Measures request durations
- `requestSizeHistogram`: Measures request sizes
- `responseSizeHistogram`: Measures response sizes

**Key Methods**:
- `use(req, res, next)`: Middleware handler that collects request/response metrics
- `getRouteFromRequest(req)`: Extracts route pattern from request
- `calculateRequestSize(req)`: Calculates size of request in bytes
- `trackResponse(res, baseAttributes, startTime)`: Tracks response metrics

##### MetricsController
**Purpose**: Exposes metrics endpoint for Prometheus scraping.
**Key Methods**:
- `getMetrics(req)`: Returns metrics in Prometheus format

### Trace

#### Decorators

##### @Trace
**Purpose**: Decorator for instrumenting methods with tracing.
**Parameters**:
- `optionsOrName: TraceOptions | string`: Trace configuration or name

**TraceOptions**:
- `kind?: SpanKind`: Type of span
- `attributes?: Attributes`: Span attributes
- `root?: boolean`: Whether span should be a root span
- `name?: string`: Span name

##### @TracePlain
**Purpose**: Alternative trace decorator for non-NestJS classes.

#### Injectors

##### BaseInjector
**Purpose**: Abstract base class for all trace injectors.
**Key Methods**:
- `getControllers()`: Generator for iterating through controllers
- `getProviders()`: Generator for iterating through providers
- `wrap(func, traceName, spanOptions, requireParentSpan, dynamicAttributesHook)`: Wraps function with tracing
- `recordException(error, stackObjects, span)`: Records exceptions in spans
- `affect(target)`: Marks objects as affected by tracing
- `inject()`: Abstract method implemented by concrete injectors

##### Specialized Injectors
The project includes multiple specialized injectors for different NestJS components:

- `ControllerInjector`: Injects tracing into controller methods
- `DecoratorInjector`: Injects tracing into methods with `@Trace` decorator
- `ProviderInjector`: Injects tracing into injectable providers
- `MiddlewareInjector`: Injects tracing into NestJS middleware
- `PipeInjector`: Injects tracing into NestJS pipes
- `GuardInjector`: Injects tracing into NestJS guards
- `InterceptorInjector`: Injects tracing into NestJS interceptors
- `ExceptionFilterInjector`: Injects tracing into NestJS exception filters
- `TypeormInjector`: Injects tracing into TypeORM operations
- `ScheduleInjector`: Injects tracing into scheduled tasks (from @nestjs/schedule)
- `EnhancerInjector`: Base class for pipe, guard, and interceptor injectors