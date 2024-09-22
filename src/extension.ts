import * as vscode from 'vscode';
import ollama, { type ChatResponse, Message } from 'ollama';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'codevizier.vizierCreateTests',
    async () => {
      const prompt = await createPrompt();

      if (!prompt) {
        return;
      }

      vscode.window.showInformationMessage('Vizier is creating tests...');

      try {
        // TODO: Move to the extension configuration
        const response = await ollama.chat({
          model: 'deepseek-coder:6.7b',
          messages: [prompt],
          options: {
            temperature: 0.1,
          },
        });

        const { programmingLanguage, content } =
          extractCodeFromResponse(response);
        if (!programmingLanguage) {
          vscode.window.showErrorMessage(
            'Failed to determine the programming language in the response'
          );
          return;
        }

        if (!content) {
          vscode.window.showErrorMessage(
            'Failed to extract tests from the response'
          );
          return;
        }

        await processTestsCode(content, programmingLanguage);
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

function getDocument(): vscode.TextDocument | null {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showErrorMessage('No active editor');
    return null;
  }

  return activeEditor.document;
}

async function createPrompt(): Promise<Message | null> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showErrorMessage('No active editor');
    return null;
  }

  const document = activeEditor.document;
  const fileName = document.uri.path.split('/').pop();

  const selection = activeEditor.selection;
  const content = selection.isEmpty
    ? document.getText()
    : document.getText(selection);

  const prompt = {
    role: 'user',
    content: `
      Act as a proficient developer.
      You have expertise in JavaScript, TypeScript, React, Redux, Redux ToolKit, Redux Toolkit Query, Jest, React Testing Library.
      Create tests for the following code snippet:


      <code>
        // File: ${fileName}
        ${content}
      </code>


      Provide maximum coverage for statements, branches, and functions. Make sure to test all edge cases.
      Use the same programming language for tests as used in the source code.
      Provide just the code for the tests in your response, omit the comments.
      If there are more than one testing item in the content, create tests in a separate code block for each item.
    `,
  };

  return prompt;
}

function getProgrammingLanguage(content: string): string | null {
  const regex = /```([a-z]+)/;
  const match = content.match(regex);

  return match ? match[1] : null;
}

function extractCodeFromResponse(response: ChatResponse) {
  const programmingLanguage = getProgrammingLanguage(response.message.content);
  const regex = new RegExp(
    '```' + programmingLanguage + '([\\s\\S]*?)```',
    'i'
  );
  const match = response.message.content.match(regex);
  const content = match ? match[1].trim() : '';
  return { programmingLanguage, content };
}

async function processTestsCode(content: string, programmingLanguage: string) {
  const document = getDocument();
  if (!document) {
    return;
  }

  const choice = await vscode.window.showQuickPick(
    ['Create New File', 'Copy to Clipboard', 'Insert into Current File'],
    {
      placeHolder: 'The tests have been created. Choose an action',
    }
  );

  if (choice === 'Create New File') {
    const originalFilePath = document.uri.fsPath;
    const originalFileName = originalFilePath.split('/').pop();

    if (!originalFileName) {
      vscode.window.showErrorMessage(
        'Failed to determine the original file name'
      );
      return;
    }

    const newFileName = originalFileName.replace(/(\.[^\.]+)$/, '.tests$1');
    const newFilePath = originalFilePath.replace(originalFileName, newFileName);
    const newDocument = await vscode.workspace.openTextDocument({
      content,
      language: programmingLanguage,
    });
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(newFilePath),
      Buffer.from(content)
    );
    await vscode.window.showTextDocument(newDocument);
    vscode.window.showInformationMessage(
      `Code inserted into new file: ${newFileName}`
    );
  } else if (choice === 'Copy to Clipboard') {
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage('Code copied to clipboard');
  } else if (choice === 'Insert into Current File') {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    // Insert text at the end of the active document
    const endPosition = document.lineAt(document.lineCount - 1).range.end;
    activeEditor.edit((editBuilder) => {
      editBuilder.insert(endPosition, `\n${content}\n`);
    });

    vscode.window.showInformationMessage('Code inserted into current file');
  } else {
    vscode.window.showWarningMessage('No action selected');
  }
}
