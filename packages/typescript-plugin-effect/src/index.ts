import type ts from "typescript"

const init = (modules: { typescript: typeof ts }) => {
  const ts = modules.typescript

  function create(info: ts.server.PluginCreateInfo) {
    info.project.projectService.logger.info(
      "[@typescript-plugin-effect] Plugin created",
    )
    const oldLS = info.languageService

    // create the proxy
    const proxy: ts.LanguageService = Object.create(null)
    for (const k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      // @ts-expect-error
      proxy[k] = (...args: Array<{}>) => oldLS[k].apply(oldLS, args)
    }

    // Add our custom diagnostics
    proxy.getSemanticDiagnostics = (fileName: string) => {
      const diagnostics = oldLS.getSemanticDiagnostics(fileName)
      const program = oldLS.getProgram()
      if (!program) return diagnostics

      const sourceFile = program.getSourceFile(fileName)
      if (!sourceFile) return diagnostics

      // Add test diagnostic
      diagnostics.push({
        file: sourceFile,
        start: 0,
        length: 1,
        messageText: "Plugin is loaded and running",
        category: ts.DiagnosticCategory.Warning,
        code: 100000,
      })

      ts.forEachChild(sourceFile, function walk(node) {
        // Check for double Effect wrapping
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText() === "Effect"
        ) {
          const arg = node.arguments[0]
          if (arg) {
            const argType = program.getTypeChecker().getTypeAtLocation(arg)
            if (argType.symbol?.name?.includes("Effect")) {
              diagnostics.push({
                file: sourceFile,
                start: node.getStart(),
                length: node.getWidth(),
                messageText:
                  "Avoid wrapping Effect values in another Effect. Use Effect.flatten or Effect.flatMap instead.",
                category: ts.DiagnosticCategory.Error,
                code: 100002,
              })
            }
          }
        }

        // Add this new check for Object methods on Effect values
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText() === "Object"
        ) {
          const methodName = node.expression.name.getText()
          const arg = node.arguments[0]
          if (arg) {
            const argType = program.getTypeChecker().getTypeAtLocation(arg)
            if (argType.symbol?.name?.includes("Effect")) {
              diagnostics.push({
                file: sourceFile,
                start: node.getStart(),
                length: node.getWidth(),
                messageText: `Cannot use Object.${methodName} directly on an Effect value. Use Effect.map to access the inner value first.`,
                category: ts.DiagnosticCategory.Error,
                code: 100003,
              })
            }
          }
        }

        ts.forEachChild(node, walk)
      })

      return diagnostics
    }

    return proxy
  }

  return { create }
}

export default init
