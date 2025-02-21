import * as vscode from "vscode";
import { instrumentationStore } from "./instrumentationStore";

export class CodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {}

  // refresh logic
  public static reload() {
    if (CodeLensProvider.instance) {
      CodeLensProvider.instance._onDidChangeCodeLenses.fire();
    }
  }

  // Keep a static instance if we want easy global access
  static instance: CodeLensProvider | null = null;

  provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    // 1. We parse the doc for tasks or canister definitions
    //    e.g. a simple approach: look for lines with 'export const <name> ='
    //    This is naive, you might want a real parser or comment-based approach

    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      const match = line.match(/export const (\w+)\s*=/);
      if (match) {
        const taskName = match[1];
        // create a CodeLens for that line
        const range = new vscode.Range(index, 0, index, line.length);
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `Run ${taskName}`,
            command: "extension.runIceTask",
            arguments: [taskName]
          })
        );

        // Check instrumentationStore if there's a result
        const logs = instrumentationStore.getLogs().filter(l => l.actorName === taskName);
        // or if you store logs by 'taskName' instead of 'actorName', adapt this logic
        if (logs.length > 0) {
          const lastLog = logs[logs.length - 1];
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `Last call: ${lastLog.methodName} => ${JSON.stringify(lastLog.result)}`,
              command: "" // no command, just a display
            })
          );
        }
      }
    });

    return codeLenses;
  }
}

export function createCodeLensProvider(): CodeLensProvider {
  const provider = new CodeLensProvider();
  CodeLensProvider.instance = provider;
  return provider;
}