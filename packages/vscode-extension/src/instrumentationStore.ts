// Example: In-memory store of task/actor calls

type MethodCallLog = {
    actorName: string;
    methodName: string;
    args: any[];
    result: any;
    timestamp: number;
  };
  
  class InstrumentationStore {
    private logs: MethodCallLog[] = [];
  
    addMethodCallLog(log: MethodCallLog) {
      this.logs.push(log);
    }
  
    getLogs() {
      return this.logs.slice(); // a shallow copy
    }
  }
  
  export const instrumentationStore = new InstrumentationStore();