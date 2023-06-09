import { CustomDecorator, Logger, SetMetadata } from '@nestjs/common'
import { MetadataScanner } from '@nestjs/core'
import type { SpanKind } from '@opentelemetry/api/build/src/trace/span_kind'
import type { Attributes } from '@opentelemetry/api/build/src/common/Attributes'
import { BaseInjector } from '../injectors'
import { OpenTelemetryConstants } from '../../open-telemetry.constants'

export interface TraceOptions {
  /**
   * The SpanKind of a span
   * @default {@link SpanKind.INTERNAL}
   */
  kind?: SpanKind
  /** A span's attributes */
  attributes?: Attributes
  /** The new span should be a root span. (Ignore parent from context). */
  root?: boolean
  name?: string
}

export function Trace<T extends TraceOptions | undefined | string>(optionsOrName?: T): (keyof T) extends never ? CustomDecorator : MethodDecorator {
  const options = typeof optionsOrName === 'string' ? { name: optionsOrName } : optionsOrName ?? {}
  return SetMetadata(OpenTelemetryConstants.TRACE_METADATA, options)
}

const metadataScanner = new MetadataScanner()
const logger = new Logger('TracePlainClass')
export function TracePlainClass(): ClassDecorator {
  return (target) => {
    const injector = BaseInjector.prototype
    const keys = metadataScanner.getAllMethodNames(
      target.prototype,
    )

    for (const key of keys) {
      if (!injector['isAffected'](target.prototype[key])) {
        const name = `Class -> ${target.name}.${key}`
        target.prototype[key] = injector['wrap'](
          target.prototype[key],
          name,
        )
        logger.log(`Mapped ${name}`)
      }
    }
    return target
  }
}
