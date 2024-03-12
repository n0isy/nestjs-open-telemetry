import type { CanActivate } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { EnhancerInjector, EnhancerType } from './enhancer.injector'

@Injectable()
export class GuardInjector extends EnhancerInjector<CanActivate> {
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer, EnhancerType.GUARD)
  }
}
