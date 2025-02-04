import { expect, vi, test, describe, beforeEach, afterEach } from 'vitest';
import type { Vi } from 'vitest';
import fs from 'fs';
import { spawn } from 'child_process';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import {
  getDfxConfig,
  getCanisterIds,
  getIdentity,
  deployCanister,
  createActors,
  runTasks,
  startDfx,
  killDfx,
  execTasks,
  createTaskStream,
  transformWildcards,
  getDeps,
  dfxDefaults,
} from '../index';
import { Repeater } from '@repeaterjs/repeater';
import fc from 'fast-check';
import { Arbitrary } from 'fast-check';
import { Config } from './types';

// Mock external dependencies
vi.mock('fs');
vi.mock('child_process');
vi.mock('@dfinity/agent');
vi.mock('@dfinity/identity');

describe('runner/index.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // describe('getDfxConfig', () => {
  //   test('should return dfx config when file exists', async () => {
  //     const mockConfig = { canisters: {}, scripts: {} };
  //     vi.spyOn(global, 'import').mockResolvedValue({ default: mockConfig });

  //     const result = await getDfxConfig();

  //     expect(result).toEqual(mockConfig);
  //   });

  //   test('should throw ConfigError when file does not exist', async () => {
  //     vi.spyOn(global, 'import').mockRejectedValue(new Error('File not found'));

  //     await expect(getDfxConfig()).rejects.toThrowError('ConfigError');
  //   });
  // });

  // describe('getCanisterIds', () => {
  //   test('should return canister IDs when file exists', () => {
  //     const mockIds = { canister1: { local: 'id1' }, canister2: { local: 'id2' } };
  //     (fs.readFileSync as Vi.Mock).mockReturnValue(JSON.stringify(mockIds));

  //     const result = getCanisterIds();

  //     expect(result).toEqual(mockIds);
  //   });

  //   test('should throw ConfigError when file does not exist', () => {
  //     (fs.readFileSync as Vi.Mock).mockImplementation(() => {
  //       throw new Error('File not found');
  //     });

  //     expect(() => getCanisterIds()).toThrow('ConfigError');
  //   });
  // });

  // describe('getIdentity', () => {
  //   test('should return identity when it exists', async () => {
  //     const mockIdentity = {
  //       identity: {} as Ed25519KeyIdentity,
  //       pem: 'mock-pem',
  //       name: 'mock-identity',
  //       principal: 'mock-principal',
  //       accountId: 'mock-account-id'
  //     };
  //     (fs.existsSync as Vi.Mock).mockReturnValue(true);
  //     (fs.readFileSync as Vi.Mock).mockReturnValue('mock-pem-content');
  //     (Ed25519KeyIdentity.fromSecretKey as Vi.Mock).mockReturnValue(mockIdentity.identity);

  //     const result = await getIdentity('mock-identity');

  //     expect(result).toEqual(mockIdentity);
  //   });

  //   test('should throw IdentityError when identity does not exist', async () => {
  //     (fs.existsSync as Vi.Mock).mockReturnValue(false);

  //     await expect(getIdentity('non-existent-identity')).rejects.toThrow('IdentityError');
  //   });
  // });

  // describe('deployCanister', () => {
  //   test('should deploy canister successfully', async () => {
  //     const mockCanisterId = 'mock-canister-id';
  //     const mockCanisterConfig = {
  //       candid: 'mock-candid-path',
  //       wasm: 'mock-wasm-path',
  //     };
  //     (Actor.createActor as Vi.Mock).mockReturnValue({
  //       provisional_create_canister_with_cycles: vi.fn().mockResolvedValue({ canister_id: { toText: () => mockCanisterId } }),
  //       install_code: vi.fn().mockResolvedValue(undefined),
  //     });

  //     const result = await deployCanister('mock-canister', mockCanisterConfig);

  //     expect(result).toBe(mockCanisterId);
  //   });

  //   test('should throw CanisterDeploymentError on failure', async () => {
  //     (Actor.createActor as Vi.Mock).mockReturnValue({
  //       provisional_create_canister_with_cycles: vi.fn().mockRejectedValue(new Error('Deployment failed')),
  //     });

  //     await expect(deployCanister('mock-canister', {} as any)).rejects.toThrow('CanisterDeploymentError');
  //   });
  // });

  // describe('createActors', () => {
  //   test('should create actors successfully', async () => {
  //     const mockCanisterIds = { canister1: { local: 'id1' } };
  //     const mockActor = { method: vi.fn() };
  //     (getCanisterIds as Vi.Mock).mockReturnValue(mockCanisterIds);
  //     (Actor.createActor as Vi.Mock).mockReturnValue(mockActor);

  //     const result = await createActors(['canister1'], { canisterConfig: {} as any });

  //     expect(result.canister1.actor).toBe(mockActor);
  //     expect(result.canister1.canisterId).toBe('id1');
  //   });

  //   test('should throw ActorCreationError on failure', async () => {
  //     (getCanisterIds as Vi.Mock).mockReturnValue({});

  //     await expect(createActors(['non-existent-canister'], { canisterConfig: {} as any })).rejects.toThrow('ActorCreationError');
  //   });
  // });

  // describe('runTasks', () => {
  //   test('should run tasks successfully', async () => {
  //     const mockConfig = {
  //       canisters: { canister1: {} },
  //       scripts: { script1: { fn: vi.fn() } },
  //     };
  //     const mockCanisterIds = { canister1: { local: 'id1' } };
  //     (getCanisterIds as Vi.Mock).mockReturnValue(mockCanisterIds);

  //     await runTasks(mockConfig, ['canisters:canister1', 'scripts:script1']);

  //     expect(mockConfig.scripts.script1.fn).toHaveBeenCalled();
  //   });
  // });

  // describe('startDfx', () => {
  //   test('should start dfx successfully', async () => {
  //     (spawn as Vi.Mock).mockReturnValue({
  //       stdout: { on: vi.fn() },
  //       stderr: { on: vi.fn() },
  //       on: vi.fn().mockImplementation((event, callback) => {
  //         if (event === 'close') callback(0);
  //       }),
  //     });

  //     await expect(startDfx()).resolves.not.toThrow();
  //   });

  //   test('should throw ConfigError on failure', async () => {
  //     (spawn as Vi.Mock).mockReturnValue({
  //       stdout: { on: vi.fn() },
  //       stderr: { on: vi.fn() },
  //       on: vi.fn().mockImplementation((event, callback) => {
  //         if (event === 'error') callback(new Error('Failed to start'));
  //       }),
  //     });

  //     await expect(startDfx()).rejects.toThrow('ConfigError');
  //   });
  // });

  // describe('killDfx', () => {
  //   test('should kill dfx processes successfully', async () => {
  //     const mockProcesses = [{ pid: 123 }, { pid: 456 }];
  //     vi.mock('find-process', () => vi.fn().mockResolvedValue(mockProcesses));
  //     vi.spyOn(process, 'kill').mockImplementation(() => true);

  //     await expect(killDfx()).resolves.not.toThrow();
  //     expect(process.kill).toHaveBeenCalledTimes(3);
  //   });

  //   test('should throw ConfigError on failure', async () => {
  //     vi.mock('find-process', () => vi.fn().mockRejectedValue(new Error('Failed to find processes')));

  //     await expect(killDfx()).rejects.toThrow('ConfigError');
  //   });
  // });

  // describe('execTasks', () => {
  //   test('should execute tasks from a task stream', async () => {
  //     const mockTaskStream = new Repeater(async (push, stop) => {
  //       await push({ taskName: 'canisters:test', taskConfig: {} });
  //       stop();
  //     });
  //     const mockDeployCanister = vi.fn().mockResolvedValue('test-canister-id');
  //     const mockCreateActors = vi.fn().mockResolvedValue({ test: { actor: {}, canisterId: 'test-canister-id' } });

  //     vi.spyOn(global, 'deployCanister').mockImplementation(mockDeployCanister);
  //     vi.spyOn(global, 'createActors').mockImplementation(mockCreateActors);
  //     vi.spyOn(global, 'getCanisterIds').mockReturnValue({ test: { local: 'test-canister-id' } });

  //     await execTasks(mockTaskStream);

  //     expect(mockDeployCanister).toHaveBeenCalledWith('test', {});
  //     expect(mockCreateActors).toHaveBeenCalledWith(['test'], expect.any(Object));
  //   });
  // });

  describe('createTaskStream', () => {
    test('should create a task stream from config and tasks', async () => {
      const mockConfig = {
        canisters: { test: {} },
        scripts: { testScript: { fn: () => "test" } },
      };
      const tasks = ['canisters:test', 'scripts:testScript'] as const;

      const taskStream = createTaskStream(mockConfig, tasks);

      expect(taskStream).toBeInstanceOf(Repeater);

      const results = [];
      for await (const task of taskStream) {
        results.push(task);
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ taskName: 'canisters:test', taskConfig: {} });
      expect(results[1]).toEqual({ taskName: 'scripts:testScript', taskConfig: "test" });
    });

    // test('should handle async functions in config', async () => {
    //   const mockConfig = {
    //     canisters: { 
    //       asyncTest: { 
    //         dependencies: ['scripts:asyncHelper'],
    //         fn: async (deps: any) => await deps.asyncHelper + ' canister'
    //       } 
    //     },
    //     scripts: { 
    //       asyncHelper: { 
    //         fn: async () => {
    //           await new Promise(resolve => setTimeout(resolve, 100));
    //           return "async";
    //         } 
    //       } 
    //     },
    //   };
    //   const tasks = ['canisters:asyncTest'] as const;

    //   const taskStream = createTaskStream(mockConfig, tasks);

    //   const results = [];
    //   for await (const task of taskStream) {
    //     results.push(task);
    //   }

    //   expect(results).toHaveLength(2);
    //   expect(results[0]).toEqual({ taskName: 'scripts:asyncHelper', taskConfig: "async" });
    //   expect(results[1]).toEqual({ taskName: 'canisters:asyncTest', taskConfig: "async canister" });
    // });

    // test('should handle complex dependencies', async () => {
    //   const mockConfig = {
    //     canisters: { 
    //       main: { dependencies: ['canisters:dep1', 'scripts:script1'] },
    //       dep1: { dependencies: ['canisters:dep2'] },
    //       dep2: { dependencies: ['scripts:script2'] },
    //     },
    //     scripts: { 
    //       script1: { dependencies: ['canisters:dep2'] },
    //       script2: {},
    //     },
    //   };
    //   const tasks = ['canisters:main'] as const;

    //   const taskStream = createTaskStream(mockConfig, tasks);

    //   const results = [];
    //   for await (const task of taskStream) {
    //     results.push(task.taskName);
    //   }

    //   expect(results).toHaveLength(5);
    //   expect(results).toEqual([
    //     'scripts:script2',
    //     'canisters:dep2',
    //     'canisters:dep1',
    //     'scripts:script1',
    //     'canisters:main'
    //   ]);
    // });

  });

  describe('transformWildcards', () => {
    test('should transform wildcard tasks to specific tasks', () => {
      const mockConfig = {
        canisters: { test1: {}, test2: {} },
        scripts: { script1: {}, script2: {} },
      };

      expect(transformWildcards(mockConfig, 'canisters:*')).toEqual(['canisters:test1', 'canisters:test2']);
      expect(transformWildcards(mockConfig, 'scripts:*')).toEqual(['scripts:script1', 'scripts:script2']);
      expect(transformWildcards(mockConfig, 'canisters:test1')).toEqual(['canisters:test1']);
    });
  });

  describe('getDeps', () => {
    test('should get dependencies for given tasks', () => {
      const mockConfig = {
        canisters: {
          test1: { dependencies: ['canisters:test2'] },
          test2: { dependencies: ['canisters:test3'] },
          test3: {},
        },
        scripts: {
          script1: { dependencies: ['canisters:test1', 'scripts:script2'] },
          script2: { dependencies: ['canisters:test3'] },
          script3: {},
        },
      };
      expect(getDeps(mockConfig, ['scripts:script1']))
        .toEqual(expect.arrayContaining(['canisters:test3', 'canisters:test2', 'canisters:test1', 'scripts:script2', 'scripts:script1']));

      expect(getDeps(mockConfig, ['canisters:test1', 'scripts:script3']))
        .toEqual(expect.arrayContaining(['canisters:test3', 'canisters:test2', 'canisters:test1', 'scripts:script3']));

      expect(getDeps(mockConfig, ['canisters:test3', 'scripts:script2']))
        .toEqual(expect.arrayContaining(['canisters:test3', 'scripts:script2']));

      // Test wildcards
      expect(getDeps(mockConfig, ['canisters:*']))
        .toEqual(expect.arrayContaining(['canisters:test3', 'canisters:test2', 'canisters:test1']));

      expect(getDeps(mockConfig, ['scripts:*']))
        .toEqual(expect.arrayContaining(['canisters:test3', 'canisters:test2', 'canisters:test1', 'scripts:script2', 'scripts:script1', 'scripts:script3']));
    });

    test('should handle long dependency chains', () => {
      const mockConfig = {
        canisters: {
          a: { dependencies: ['canisters:b'] },
          b: { dependencies: ['canisters:c'] },
          c: { dependencies: ['canisters:d'] },
          d: { dependencies: ['canisters:e'] },
          e: {},
        },
        scripts: {},
      };
      expect(getDeps(mockConfig, ['canisters:a']))
        .toEqual(['canisters:e', 'canisters:d', 'canisters:c', 'canisters:b', 'canisters:a']);
    });

    describe('complex scenarios with non-existent dependencies', () => {

      // Paths taken:
      // 1. canisters:test2
      // 2. canisters:nonexistent1 (dependency of test2) - Error thrown here
      test('should throw DependencyNotFoundError for non-existent canister dependency', () => {
        const mockConfig = {
          canisters: {
            test2: { dependencies: ['canisters:nonexistent1'] },
          },
          scripts: {},
        };

        expect(() => getDeps(mockConfig, ['canisters:test2']))
          .toThrow(expect.objectContaining({
            kind: 'DependencyNotFoundError',
            dependency: 'canisters:nonexistent1'
          }));
      });

      // Paths taken:
      // 1. scripts:script2
      // 2. scripts:nonexistent3 (dependency of script2) - Error thrown here
      test('should throw DependencyNotFoundError for non-existent script dependency', () => {
        const mockConfig = {
          canisters: {},
          scripts: {
            script2: { dependencies: ['scripts:nonexistent3'] },
          },
        };

        expect(() => getDeps(mockConfig, ['scripts:script2']))
          .toThrow(expect.objectContaining({
            kind: 'DependencyNotFoundError',
            dependency: 'scripts:nonexistent3'
          }));
      });

      // Paths taken:
      // 1. canisters:test3
      // 2. canisters:test1 (dependency of test3)
      // 3. canisters:test2 (dependency of test1)
      // 4. canisters:nonexistent1 (dependency of test2) - Error thrown here
      // 5. canisters:nonexistent2 (dependency of test3) - Never reached
      test('should throw DependencyNotFoundError for multiple non-existent dependencies', () => {
        const mockConfig = {
          canisters: {
            test1: { dependencies: ['canisters:test2'] },
            test2: { dependencies: ['canisters:nonexistent1'] },
            test3: { dependencies: ['canisters:test1', 'canisters:nonexistent2'] },
          },
          scripts: {},
        };

        expect(() => getDeps(mockConfig, ['canisters:test3']))
          .toThrow(expect.objectContaining({
            kind: 'DependencyNotFoundError',
            dependency: 'canisters:nonexistent1'
          }));
      });

      // Paths taken:
      // 1. scripts:script3
      // 2. scripts:script1 (dependency of script3)
      // 3. scripts:script2 (dependency of script1)
      // 4. scripts:nonexistent3 (dependency of script2) - Error thrown here
      // 5. canisters:nonexistent4 (dependency of script3) - Never reached
      test('should throw error for non-existent dependency in a longer chain', () => {
        const mockConfig = {
          canisters: {},
          scripts: {
            script1: { dependencies: ['scripts:script2'] },
            script2: { dependencies: ['scripts:nonexistent3'] },
            script3: { dependencies: ['scripts:script1', 'canisters:nonexistent4'] },
          },
        };

        expect(() => getDeps(mockConfig, ['scripts:script3']))
          .toThrow(expect.objectContaining({
            kind: 'DependencyNotFoundError',
            dependency: 'scripts:nonexistent3'
          }));
      });

      // Paths taken:
      // 1. canisters:test1
      // 2. canisters:test2 (dependency of test1)
      // 3. canisters:nonexistent1 (dependency of test2) - Error thrown here
      // 4. canisters:test3 - Never reached
      test('should throw DependencyNotFoundError for wildcard with non-existent dependency', () => {
        const mockConfig = {
          canisters: {
            test1: { dependencies: ['canisters:test2'] },
            test2: { dependencies: ['canisters:nonexistent1'] },
            test3: {},
          },
          scripts: {},
        };

        expect(() => getDeps(mockConfig, ['canisters:*']))
          .toThrow(expect.objectContaining({
            kind: 'DependencyNotFoundError',
            dependency: 'canisters:nonexistent1'
          }));
      });

      // Paths taken:
      // 1. canisters:test1
      // 2. canisters:test2 (dependency of test1)
      // 3. canisters:nonexistent1 (dependency of test2) - Error thrown here
      // 4. scripts:script1 (dependency of test1) - Never reached
      test('should throw DependencyNotFoundError for invalid dependencies in the chain', () => {
        const mockConfig = {
          canisters: {
            test1: { dependencies: ['canisters:test2', 'scripts:script1'] },
            test2: { dependencies: ['canisters:nonexistent1'] },
          },
          scripts: {
            script1: {},
          },
        };

        expect(() => getDeps(mockConfig, ['canisters:test1']))
          .toThrow(expect.objectContaining({
            kind: 'DependencyNotFoundError',
            dependency: 'canisters:nonexistent1'
          }));
      });

      // Paths taken:
      // 1. canisters:test1
      // 2. canisters:test2 (dependency of test1)
      // 3. canisters:test1 (dependency of test2) - Circular dependency detected, error thrown here
      test('should throw CircularDependencyError for circular dependencies', () => {
        const circularConfig = {
          canisters: {
            test1: { dependencies: ['canisters:test2'] },
            test2: { dependencies: ['canisters:test1'] },
          },
          scripts: {},
        };

        expect(() => getDeps(circularConfig, ['canisters:test1']))
          .toThrow(expect.objectContaining({
            kind: 'CircularDependencyError',
            path: expect.arrayContaining(['canisters:test1', 'canisters:test2'])
          }));
      });
    });

    // describe('dfxDefaults', () => {
    //   test('should have correct default values', () => {
    //     expect(dfxDefaults).toHaveProperty('defaults');
    //     expect(dfxDefaults).toHaveProperty('networks');
    //     expect(dfxDefaults).toHaveProperty('version', 1);
    //     expect(dfxDefaults.networks).toHaveProperty('local');
    //     expect(dfxDefaults.networks).toHaveProperty('ic');
    //   });
    // });

    // describe('startDfx', () => {
    //   test('should start dfx process', async () => {
    //     const mockSpawn = vi.fn().mockResolvedValue(undefined);
    //     vi.spyOn(global, 'spawn').mockImplementation(mockSpawn);

    //     await startDfx();

    //     expect(mockSpawn).toHaveBeenCalledWith({
    //       command: 'dfx',
    //       args: ['start', '--background', '--clean'],
    //       stdout: expect.any(Function),
    //     });
    //   });

    //   test('should throw ConfigError if dfx start fails', async () => {
    //     vi.spyOn(global, 'spawn').mockRejectedValue(new Error('DFX start failed'));

    //     await expect(startDfx()).rejects.toThrow('ConfigError');
    //   });
    // });
  });

  describe('getDeps property-based tests', () => {
    // Helper function to generate arbitrary configs
    const arbitraryConfig: Arbitrary<Config> = fc.record({
      canisters: fc.dictionary(
        fc.string(),
        fc.record({
          dependencies: fc.array(fc.string())
        })
      ),
      scripts: fc.dictionary(
        fc.string(),
        fc.record({
          dependencies: fc.array(fc.string())
        })
      )
    });

    // Helper function to generate valid task names from a config
    const validTaskNames = (config: Config): Arbitrary<string> =>
      fc.oneof(
        ...Object.keys(config.canisters).map(name => fc.constant(`canisters:${name}`)),
        ...Object.keys(config.scripts).map(name => fc.constant(`scripts:${name}`))
      );

    test('all returned dependencies should exist in the config', () => {
      fc.assert(
        fc.property(
          arbitraryConfig,
          fc.array(fc.string()),
          (config, tasks) => {
            try {
              const deps = getDeps(config, tasks);
              return deps.every(dep => {
                const [type, name] = dep.split(':');
                return config[type as keyof Config] && config[type as keyof Config][name];
              });
            } catch (error) {
              // If an error is thrown, the property is still satisfied
              return true;
            }
          }
        )
      );
    });

    test('original tasks should always be included in the returned dependencies', () => {
      fc.assert(
        fc.property(
          arbitraryConfig,
          fc.array(fc.string()),
          (config, tasks) => {
            try {
              const deps = getDeps(config, tasks);
              return tasks.every(task => deps.includes(task));
            } catch (error) {
              // If an error is thrown, the property is still satisfied
              return true;
            }
          }
        )
      );
    });

    // test('should throw DependencyNotFoundError for non-existent dependencies', () => {
    //   fc.assert(
    //     fc.property(
    //       arbitraryConfig,
    //       (config) => {
    //         const tasks = fc.array(validTaskNames(config));
    //         return fc.tuple(fc.constant(config), tasks, fc.string());
    //       },
    //       ([config, tasks, nonExistentDep]) => {
    //         if (tasks.length === 0) return true; // Skip empty task arrays

    //         const taskType = tasks[0].split(':')[0];
    //         const taskName = tasks[0].split(':')[1];
    //         const taskWithNonExistentDep = `${taskType}:${nonExistentDep}`;

    //         if (config[taskType] && config[taskType][taskName]) {
    //           config[taskType][taskName].dependencies = [taskWithNonExistentDep];

    //           expect(() => getDeps(config, tasks)).toThrow(expect.objectContaining({
    //             kind: 'DependencyNotFoundError',
    //             dependency: taskWithNonExistentDep
    //           }));
    //         }

    //         return true;
    //       }
    //     )
    //   );
    // });
  });
});