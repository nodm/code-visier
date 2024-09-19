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
      const content = document.getText();

      const message = {
        role: 'user',
        content: `
				  You are a seasoned developer.
					You have expertise in JavaScript, TypeScript, React, Redux, Redux ToolKit, Redux Toolkit Query, Jest, React Testing Library.
					Create tests for the following code snippet:

					<code>
					  ${content}
					</code>

					Provide maximum coverage for statements, branches, and functions. Make sure to test all edge cases.
				`,
      };

      try {
        const response = await ollama.chat({
          model: 'deepseek-coder:6.7b',
          messages: [message],
          // stream: true,
          options: {
            temperature: 0.1,
          },
        });

        // for await (const part of response) {
        //   process.stdout.write(part.message.content);
        // }

        // Insert text at the end of the active document
        const endPosition = document.lineAt(document.lineCount - 1).range.end;
        activeEditor.edit((editBuilder) => {
          editBuilder.insert(endPosition, `\n${response.message.content}\n`);
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
