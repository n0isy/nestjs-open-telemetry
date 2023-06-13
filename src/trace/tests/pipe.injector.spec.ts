import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Controller, Get, Param, PipeTransform, UsePipes } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { PipeInjector } from '../injectors'
import { OpenTelemetryModule } from '../../open-telemetry.module'

describe('Tracing Pipe Injector Test', () => {
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessor: exporter,
    autoInjectors: [PipeInjector],
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace global pipe', async () => {
    // given
    class HelloPipe implements PipeTransform {
      async transform() {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      providers: [{ provide: APP_PIPE, useClass: HelloPipe }],
    }).compile()
    const app = context.createNestApplication()
    await app.init()
    const injector = app.get(PipeInjector)

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const providers = injector.getProviders()

    // when
    for await (const provider of providers) {
      if (
        typeof provider.token === 'string'
        && provider.token.includes(APP_PIPE)
      )
        await provider.metatype.prototype.transform(1)
    }

    // then
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pipe -> Global -> HelloPipe' }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should trace controller pipe', async () => {
    // given
    class HelloPipe implements PipeTransform {
      async transform() {}
    }

    @Controller('hello')
    class HelloController {
      @Get()
      @UsePipes(HelloPipe)
      async hi() {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await HelloPipe.prototype.transform()

    // then
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pipe -> HelloPipe' }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should trace param pipe', async () => {
    // given
    class HelloPipe implements PipeTransform {
      async transform(v: any) { return v }
    }

    @Controller('hello')
    class HelloController {
      @Get(':id')
      async hi(@Param('id', HelloPipe) _id: string) {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await HelloPipe.prototype.transform(1)

    // then
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pipe -> HelloPipe' }),
      expect.any(Object),
    )

    await app.close()
  })
})
