import { Injectable, Logger, PipeTransform, Type, assignMetadata } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { PIPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { AttributeNames, NestScope } from '../../open-telemetry.enums'
import { EnhancerInjector } from './enhancer.injector'

@Injectable()
export class PipeInjector extends EnhancerInjector {
  private readonly logger = new Logger(PipeInjector.name)

  public inject(): void {
    this.injectGlobals()
    this.injectControllers()
  }

  private injectControllers() {
    const controllers = this.getControllers()

    for (const controller of controllers) {
      const prototype = controller.metatype.prototype
      const keys = this.metadataScanner.getAllMethodNames(
        prototype,
      )

      for (const key of keys) {
        if (this.isPath(prototype[key]) || this.isPatten(prototype[key])) {
          const pipes = this.getPipes(prototype, key).map(
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
    pipe: Type<PipeTransform> | PipeTransform,
    controller: InstanceWrapper,
    func: Function,
    index?: number,
  ): PipeTransform | Type<PipeTransform> {
    const wrappedPipe = this.wrapEnhancer(pipe)
    const pipeProto = typeof wrappedPipe === 'function' ? wrappedPipe.prototype : wrappedPipe
    if (this.isAffected(pipeProto.transform))
      return wrappedPipe

    const traceName = `Pipe -> ${controller.name}.${func.name}${index != null ? `.${index}` : ''}.${pipeProto.constructor.name}`
    pipeProto.transform = this.wrap(pipeProto.transform, traceName, {
      attributes: {
        [AttributeNames.MODULE]: controller.host?.name,
        [AttributeNames.CONTROLLER]: controller.name,
        [AttributeNames.PIPE]: pipeProto.constructor.name,
        [AttributeNames.SCOPE]: NestScope.METHOD,
        [AttributeNames.PROVIDER_METHOD]: func.name,
        [AttributeNames.INJECTOR]: PipeInjector.name,
      },
    })

    if (typeof wrappedPipe === 'function' && typeof pipe === 'function')
      this.resolveWrappedEnhancer(controller.host!, pipe, wrappedPipe)

    this.logger.log(`Mapped ${traceName}`)
    return wrappedPipe
  }

  private getPipes<T extends { [k: string]: any }, K extends keyof T>(prototype: T, key: K): (Type<PipeTransform> | PipeTransform)[] {
    return Reflect.getMetadata(PIPES_METADATA, prototype[key]) ?? []
  }

  private injectGlobals() {
    for (const module of this.modulesContainer.values()) {
      for (const provider of module.providers.values()) {
        if (!provider)
          return

        if (
          typeof provider.token === 'string'
          && provider.token.includes(APP_PIPE)
        ) {
          const metatype = provider.metatype || Object.getPrototypeOf(provider.instance).constructor
          if (this.isAffected(metatype.prototype.transform))
            return

          const traceName = `Pipe -> Global -> ${metatype.name}`
          metatype.prototype.transform = this.wrap(
            metatype.prototype.transform,
            traceName,
            {
              attributes: {
                [AttributeNames.PIPE]: metatype.name,
                [AttributeNames.SCOPE]: NestScope.GLOBAL,
                [AttributeNames.INJECTOR]: PipeInjector.name,
              },
            },
          )
          this.logger.log(`Mapped ${traceName}`)
        }
      }
    }
  }
}
