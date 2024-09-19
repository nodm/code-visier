import * as vscode from 'vscode';
import ollama from 'ollama';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'codevizier.vizierCreateTests',
    async () => {
      // Access the active text editor
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const document = activeEditor.document;
      const fileName = document.uri.path.split('/').pop();

      const selection = activeEditor.selection;
      const content = selection.isEmpty
        ? document.getText()
        : document.getText(selection);

      const message = {
        role: 'user',
        content: `
				  Act as a seasoned developer.
					You have expertise in JavaScript, TypeScript, React, Redux, Redux ToolKit, Redux Toolkit Query, Jest, React Testing Library.
					Create tests for the following code snippet:


          <code>
            // File: ${fileName}
					  ${content}
					</code>


          Provide maximum coverage for statements, branches, and functions. Make sure to test all edge cases.
          Use TypeScript for writing tests.
          Provide just the code for the tests in your response, omit the comments.
				`,
      };

      try {
        const response = await ollama.chat({
          model: 'deepseek-coder:6.7b',
          messages: [message],
          options: {
            temperature: 0.1,
          },
        });

        vscode.window.showInformationMessage(response.message.content);

        const regex = /```typescript([\s\S]*?)```/;
        const match = response.message.content.match(regex);
        const extractedCode = match ? match[1].trim() : '';

        if (!extractedCode) {
          vscode.window.showWarningMessage(response.message.content);

          return;
        }

        // Insert text at the end of the active document
        const endPosition = document.lineAt(document.lineCount - 1).range.end;
        activeEditor.edit((editBuilder) => {
          editBuilder.insert(endPosition, `\n${extractedCode}\n`);
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create tests';
        vscode.window.showErrorMessage(message);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
