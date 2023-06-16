import { Injectable, PipeTransform, Type, assignMetadata } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { PIPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { AttributeNames, EnhancerScope } from '../../open-telemetry.enums'
import { EnhancerInjector, EnhancerType } from './enhancer.injector'

@Injectable()
export class PipeInjector extends EnhancerInjector<PipeTransform> {
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer, EnhancerType.PIPE)
  }

  protected override injectControllers(): void {
    const controllers = this.getControllers()

    for (const controller of controllers) {
      const prototype = controller.metatype.prototype
      const keys = this.metadataScanner.getAllMethodNames(
        prototype,
      )

      for (const key of keys) {
        if (this.isPath(prototype[key]) || this.isPatten(prototype[key])) {
          const pipes = this.getEnhancers(prototype[key]).map(
            pipe =>
              this.wrapPipe(
                pipe,
                controller,
                prototype[key],
              ),
          )
          if (pipes.length > 0) {
            Reflect.defineMetadata(
              PIPES_METADATA,
              pipes,
              prototype[key],
            )
          }
          this.wrapParamsPipes(controller, prototype, key)
        }
      }
    }
  }

  private wrapParamsPipes(controller: InstanceWrapper, prototype: object, key: string): void {
    const params = Reflect.getMetadata(ROUTE_ARGS_METADATA, prototype.constructor, key) as ReturnType<typeof assignMetadata>
    if (!params)
      return
    for (const param of Object.values(params))
      param.pipes = param.pipes.map(pipe => this.wrapPipe(pipe, controller, (prototype as any)[key], param.index))
    Reflect.defineMetadata(ROUTE_ARGS_METADATA, params, prototype.constructor, key)
  }

  private wrapPipe(
    enhancer: Type<PipeTransform> | PipeTransform,
    controller: InstanceWrapper,
    func: Function,
    index?: number,
  ): PipeTransform | Type<PipeTransform> {
    const enhancerProto = typeof enhancer === 'function' ? enhancer.prototype : enhancer
    const traceName = `${this.traceName} -> ${controller.name}.${func.name}${index != null ? `.${index}` : ''}.${enhancerProto.constructor.name}`

    return this.wrapEnhancerMethod(
      controller,
      enhancer,
      traceName,
      {
        attributes: {
          [AttributeNames.PARAM_INDEX]: index,
          [AttributeNames.ENHANCER_SCOPE]: index != null ? EnhancerScope.PARAM : EnhancerScope.METHOD,
          [AttributeNames.PROVIDER_METHOD]: func.name,
        },
      })
  }
}
