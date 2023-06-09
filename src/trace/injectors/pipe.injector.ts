import { Injectable, Logger, PipeTransform, Type } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { PIPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { AttributeNames, NestScope } from '../../open-telemetry.enums'
import { BaseInjector } from './base.injector'

@Injectable()
export class PipeInjector extends BaseInjector {
  private readonly logger = new Logger(PipeInjector.name)

  public inject(): void {
    this.injectGlobals()

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
        }
      }
    }
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

  private wrapPipe(
    pipe: Type<PipeTransform>,
    controller: InstanceWrapper,
    func: Function,
  ): Type<PipeTransform> {
    const pipeProto = pipe['prototype'] ?? pipe
    if (this.isAffected(pipeProto.transform))
      return pipe

    const traceName = `Pipe -> ${pipeProto.constructor.name}`
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
    this.logger.log(`Mapped ${traceName}`)
    return pipeProto
  }

  private getPipes<T extends { [k: string]: any }, K extends keyof T>(prototype: T, key: K): Type<PipeTransform>[] {
    const params = Reflect.getMetadata(ROUTE_ARGS_METADATA, prototype.constructor, key as string)
    const pipes: Type<PipeTransform>[] = Object.values<{ pipes: Type<PipeTransform>[] }>(params ?? {})
      .map(e => e.pipes)
      .flat()
    return pipes.concat(Reflect.getMetadata(PIPES_METADATA, prototype[key]) || [])
  }
}
