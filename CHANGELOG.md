# Changelog

## 1.3.4 (2025-03-11)

### Performance Improvements
- Refactored PrometheusSerializer creation in OpenTelemetryService to create a single instance instead of creating a new instance on each metrics collection
- Made metrics collection method asynchronous to properly support async collect() method

## 1.3.1 (2025-03-11)

### Bug Fixes
- Fixed PrometheusExporter integration to use the proper `collect()` method instead of a custom `getMetrics()` method
- Fixed Buffer usage in HTTP metrics middleware to use proper imports
- Fixed TypeScript linting issues with unused variables and proper requires

### Dependencies
- Updated peer dependencies to support newer versions of OpenTelemetry packages
- Added support for `@opentelemetry/auto-instrumentations-node` ^0.56.0
- Added support for `@opentelemetry/exporter-prometheus` ^0.57.0
- Added support for `@opentelemetry/resource-detector-container` ^0.6.0
- Added support for `@opentelemetry/sdk-node` ^0.57.0
- Added support for `@opentelemetry/sdk-metrics` ^1.30.0

### Tests
- Added comprehensive tests for Prometheus metrics integration

## 1.3.0 (2025-03-10)

### Features
- Added metrics support with Prometheus exporter
- Added metric decorators (@Counter, @Histogram, @UpDownCounter, @ObservableGauge)
- Added universal HTTP metrics middleware (works with Express and Fastify)
- Added metrics controller for exposing metrics endpoint

### Breaking Changes
- Parameter `traceInjectors` renamed to `autoInjectors`
- Parameter `spanProcessor` renamed to `spanProcessors` (now takes an array)

### Other Changes
- Added GitHub Actions CI/CD
- Added comprehensive README documentation for metrics
- Renamed package from `@easyv/nestjs-opentelemetry` to `@n0isy/nestjs-open-telemetry`
- Updated GitHub repository references to point to `n0isy/nestjs-open-telemetry`

## 1.2.0 (Previous Release)

### Features  
- Added support for NestJS 10
- Added support for @nestjs/schedule 4.x