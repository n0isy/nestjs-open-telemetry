export const SDK_CONFIG = Symbol('OPEN_TELEMETRY_SDK_CONFIG')
export const SDK_INJECTORS = Symbol('SDK_INJECTORS')
export const TRACE_METADATA = Symbol('OPEN_TELEMETRY_TRACE_METADATA')
export const TRACE_METADATA_ACTIVE = Symbol('OPEN_TELEMETRY_TRACE_METADATA_ACTIVE')
export const METRIC_METADATA = Symbol('OPEN_TELEMETRY_METRIC_METADATA')
export const METRIC_METADATA_ACTIVE = Symbol('OPEN_TELEMETRY_METRIC_METADATA_ACTIVE')

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

export enum MetricAttributeNames {
  MODULE = 'nestjs.module',
  PROVIDER = 'nestjs.provider',
  PROVIDER_METHOD = 'nestjs.provider.method',
  CONTROLLER = 'nestjs.controller',
  CONTROLLER_METHOD = 'nestjs.controller.method',
  MIDDLEWARE = 'nestjs.middleware',
  HTTP_METHOD = 'http.method',
  HTTP_STATUS_CODE = 'http.status_code',
  HTTP_ROUTE = 'http.route',
  HTTP_URL = 'http.url',
  HTTP_REQUEST_SIZE = 'http.request.size',
  HTTP_RESPONSE_SIZE = 'http.response.size',
  ERROR = 'error',
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

export enum MetricType {
  COUNTER = 'counter',
  HISTOGRAM = 'histogram',
  UP_DOWN_COUNTER = 'up_down_counter',
  OBSERVABLE_GAUGE = 'observable_gauge',
}
