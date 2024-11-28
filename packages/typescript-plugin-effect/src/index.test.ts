import { test, expect, describe } from 'vitest';
import type * as ts from 'typescript/lib/tsserverlibrary';
import init from './index';

function getDiagnostics(source: string): ts.Diagnostic[] {
  // Mock TypeScript compiler and language service
  const mockTS = {
    // Add minimal TS mock implementation
  } as unknown as typeof ts;

  const mockInfo = {
    languageService: {
      getSemanticDiagnostics: () => [],
      getProgram: () => ({
        getSourceFile: () => ({
          // Mock implementation
        }),
        getTypeChecker: () => ({
          // Mock implementation
        })
      })
    }
  } as unknown as ts.server.PluginCreateInfo;

  const plugin = init({ typescript: mockTS });
  const languageService = plugin.create(mockInfo);
  return languageService.getSemanticDiagnostics('test.ts');
}

describe('TypeScript Effect Plugin', () => {
  test('detects direct method calls on Effect values', () => {
    const source = `
      const bad = someEffect.map(x => x + 1);
    `;
    
    const diagnostics = getDiagnostics(source);
    
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].messageText).toContain('Avoid calling native methods');
  });

  test('detects double-wrapped Effects', () => {
    const source = `
      const doubleWrapped = Effect.succeed(someOtherEffect);
    `;
    
    const diagnostics = getDiagnostics(source);
    
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].messageText).toContain('Avoid wrapping Effect values');
  });

  // TODO: this causes error
  // I tried to Effect.map over an any type value, which was returned by JSON.parse, there was no linting error
  // but it caused an error at runtime. this should be added to the typescript plugin
  // There should be a warning when you try to use Effect methods on any types or some other types that might not be wrapped in Effect
  test('warns when using Effect methods on any type', () => {
    const source = `
      const parsed = JSON.parse('{"foo": "bar"}');
      const bad = Effect.map(parsed, x => x.foo); // Should warn - parsed is any
    `;
    
    const diagnostics = getDiagnostics(source);
    
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].messageText).toContain('Avoid using Effect methods on values of type any');
  });


}); 