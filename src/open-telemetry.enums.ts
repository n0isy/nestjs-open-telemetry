export enum OpenTelemetryConstants {
  SDK_CONFIG = 'OPEN_TELEMETRY_SDK_CONFIG',
  SDK_INJECTORS = 'SDK_INJECTORS',
  TRACE_METADATA = 'OPEN_TELEMETRY_TRACE_METADATA',
  TRACE_METADATA_ACTIVE = 'OPEN_TELEMETRY_TRACE_METADATA_ACTIVE',
}

export enum AttributeNames {
  MODULE = 'nestjs.module',
  PROVIDER = 'nestjs.provider',
  PROVIDER_SCOPE = 'nestjs.provider.scope',
  PROVIDER_METHOD = 'nestjs.provider.method',
  PARAM_INDEX = 'nestjs.provider.method.param.index',
  INJECTOR = 'nestjs.injector',
  CONTROLLER = 'nestjs.controller',
  ENHANCER = 'nestjs.enhancer',
  ENHANCER_TYPE = 'nestjs.enhancer.type',
  ENHANCER_SCOPE = 'nestjs.enhancer.scope',
  MIDDLEWARE = 'nestjs.middleware',
}

export enum ProviderScope {
  REQUEST = 'REQUEST',
  TRANSIENT = 'TRANSIENT',
  DEFAULT = 'DEFAULT',
}

export enum EnhancerScope {
  CONTROLLER = 'CONTROLLER',
  METHOD = 'METHOD',
  PARAM = 'PARAM',
  GLOBAL = 'GLOBAL',
}
