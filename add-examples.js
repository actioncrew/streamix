import * as fg from "fast-glob";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import * as prettier from "prettier";
import ts from "typescript";
function isFunctionLike(node) {
    return !!node && (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node));
}
/**
 * Extracts variable declarations from a describe block
 */
function extractVariableDeclarations(block, sourceFile) {
    const variables = [];
    function visitForVariables(node) {
        if (ts.isVariableStatement(node)) {
            node.declarationList.declarations.forEach(decl => {
                if (ts.isIdentifier(decl.name)) {
                    const name = decl.name.text;
                    let type;
                    let initializer;
                    if (decl.type) {
                        type = decl.type.getText(sourceFile);
                    }
                    if (decl.initializer) {
                        initializer = decl.initializer.getText(sourceFile);
                    }
                    variables.push({
                        name,
                        type,
                        initializer,
                        declaration: decl.getText(sourceFile)
                    });
                }
            });
        }
        // Don't recurse into nested describe/it blocks
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
            const callName = node.expression.text;
            if (['describe', 'it', 'test'].includes(callName)) {
                return;
            }
        }
        ts.forEachChild(node, visitForVariables);
    }
    visitForVariables(block);
    return variables;
}
/**
 * Finds variable assignments in hook bodies
 */
function extractVariableAssignments(statements, sourceFile) {
    const assignments = new Map();
    function visitForAssignments(node) {
        // Handle direct assignments: variable = value
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            if (ts.isIdentifier(node.left)) {
                const varName = node.left.text;
                const value = node.right.getText(sourceFile);
                assignments.set(varName, value);
            }
        }
        if (ts.isExpressionStatement(node)) {
            visitForAssignments(node.expression);
        }
        ts.forEachChild(node, visitForAssignments);
    }
    statements.forEach(stmt => visitForAssignments(stmt));
    return assignments;
}
/**
 * Analyzes variable usage in test bodies
 */
function findUsedVariables(code, availableVariables) {
    const usedVars = [];
    for (const variable of availableVariables) {
        const varRegex = new RegExp(`\\b${variable.name}\\b`, 'g');
        if (varRegex.test(code)) {
            usedVars.push(variable);
        }
    }
    return usedVars;
}
/**
 * Generates variable declarations with proper initialization
 */
function generateVariableDeclarations(usedVars, assignments) {
    const declarations = [];
    for (const variable of usedVars) {
        const assignment = assignments.get(variable.name);
        if (assignment) {
            // Variable has an assignment from hooks
            if (variable.type) {
                declarations.push(`let ${variable.name}: ${variable.type} = ${assignment};`);
            }
            else {
                declarations.push(`let ${variable.name} = ${assignment};`);
            }
        }
        else if (variable.initializer) {
            // Variable has an initializer in its declaration
            declarations.push(`let ${variable.declaration};`);
        }
        else {
            // Variable declared without initializer
            declarations.push(`let ${variable.declaration};`);
        }
    }
    return declarations;
}
/**
 * Enhanced test extraction with variable context
 */
export function extractTestCases(code, filePath) {
    const sourceFile = ts.createSourceFile(filePath.split(/[\\/]/).pop() || "temp.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const testExamples = [];
    function visit(node) {
        // Match describe blocks to extract context
        if (ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "describe" &&
            node.arguments.length >= 2) {
            const [firstArg, secondArg] = node.arguments;
            if (ts.isStringLiteral(firstArg) && isFunctionLike(secondArg)) {
                const suiteName = firstArg.text;
                const hooks = {
                    beforeEach: [],
                    afterEach: [],
                    beforeAll: [],
                    afterAll: [],
                };
                const tests = [];
                let suiteVariables = [];
                const hookAssignments = new Map();
                if (secondArg.body && ts.isBlock(secondArg.body)) {
                    // Extract variables from describe block
                    suiteVariables = extractVariableDeclarations(secondArg.body, sourceFile);
                    secondArg.body.statements.forEach((stmt) => {
                        if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
                            const call = stmt.expression;
                            let callee = "";
                            if (ts.isIdentifier(call.expression)) {
                                callee = call.expression.text;
                            }
                            else {
                                callee = call.expression.getText(sourceFile);
                            }
                            // Extract hooks
                            if (["beforeEach", "afterEach", "beforeAll", "afterAll"].includes(callee) &&
                                call.arguments.length > 0) {
                                const arg = call.arguments[0];
                                if (arg && isFunctionLike(arg) && arg.body) {
                                    let bodyStatements = [];
                                    let statements = [];
                                    if (ts.isBlock(arg.body)) {
                                        statements = Array.from(arg.body.statements);
                                        bodyStatements = statements.map((s) => s.getText(sourceFile));
                                    }
                                    else {
                                        bodyStatements = [arg.body.getText(sourceFile)];
                                    }
                                    hooks[callee].push(bodyStatements.join("\n"));
                                    // Extract assignments from setup hooks
                                    if (callee === "beforeEach" || callee === "beforeAll") {
                                        const assignments = extractVariableAssignments(statements, sourceFile);
                                        assignments.forEach((value, name) => {
                                            hookAssignments.set(name, value);
                                        });
                                    }
                                }
                            }
                            // Extract test cases
                            if ((callee === "it" || callee === "test") && call.arguments.length >= 2) {
                                const testDescArg = call.arguments[0];
                                const fnArg = call.arguments[1];
                                if (ts.isStringLiteral(testDescArg) && isFunctionLike(fnArg) && fnArg.body) {
                                    const description = testDescArg.text;
                                    let testBodyText;
                                    if (ts.isBlock(fnArg.body)) {
                                        testBodyText = fnArg.body.statements
                                            .map((s) => s.getText(sourceFile))
                                            .join("\n");
                                    }
                                    else {
                                        testBodyText = fnArg.body.getText(sourceFile);
                                    }
                                    const nodeStart = sourceFile.getLineAndCharacterOfPosition(call.getStart());
                                    tests.push({
                                        description,
                                        code: testBodyText,
                                        filePath,
                                        lineNumber: nodeStart.line + 1
                                    });
                                }
                            }
                        }
                    });
                }
                // Merge context with test bodies
                const mergedTests = tests.map((test) => {
                    // Find which variables are used in this test
                    const usedVars = findUsedVariables(test.code, suiteVariables);
                    // Generate proper variable declarations
                    const varDeclarations = generateVariableDeclarations(usedVars, hookAssignments);
                    const parts = [
                        // Add variable declarations first
                        ...varDeclarations,
                        // Add setup hooks (without variable assignments since we handle those above)
                        ...hooks.beforeAll.map(hook => hook.replace(/^\s*\w+\s*=\s*[^;]+;?\s*$/gm, '').trim()).filter(hook => hook.length > 0),
                        ...hooks.beforeEach.map(hook => hook.replace(/^\s*\w+\s*=\s*[^;]+;?\s*$/gm, '').trim()).filter(hook => hook.length > 0),
                        // Add the test code
                        test.code,
                        // Add cleanup hooks
                        ...hooks.afterEach,
                        ...hooks.afterAll,
                    ].filter(part => part.trim().length > 0);
                    return {
                        ...test,
                        code: parts.join("\n\n")
                    };
                });
                testExamples.push(...mergedTests);
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return testExamples;
}
/**
 * Formats code using Prettier with error handling
 */
async function formatCode(code) {
    try {
        return await prettier.format(code, {
            parser: "typescript",
            semi: true,
            singleQuote: true,
            tabWidth: 2,
            trailingComma: "es5",
        });
    }
    catch (error) {
        console.warn("Prettier formatting failed, using original code:", error);
        return code;
    }
}
/**
 * Finds matching test file for a markdown file
 */
function findTestFileForMarkdown(markdownPath, testFiles) {
    const baseName = basename(markdownPath, ".md");
    if (!baseName)
        return null;
    const possibleTestFiles = [
        `${baseName}.test.ts`,
        `${baseName}.spec.ts`,
        `${baseName}.test.js`,
        `${baseName}.spec.js`,
    ];
    for (const testFile of testFiles) {
        const testBaseName = basename(testFile);
        if (possibleTestFiles.includes(testBaseName)) {
            return testFile;
        }
    }
    return null;
}
/**
 * Injects examples into markdown content (clean code only, no descriptions)
 */
function injectExamples(markdown, examples, options) {
    if (examples.length === 0)
        return markdown;
    // Apply maxExamples limit here
    const limitedExamples = examples.slice(0, options.maxExamples);
    let examplesSection = `\n## ${options.examplesTitle}\n\n`;
    for (const example of limitedExamples) {
        examplesSection += `*From ${basename(example.filePath)}`;
        if (example.lineNumber)
            examplesSection += `:${example.lineNumber}`;
        examplesSection += "*\n\n```typescript\n";
        examplesSection += example.code;
        examplesSection += "\n```\n\n";
    }
    // Replace or append section
    const existingExamplesRegex = new RegExp(`## ${options.examplesTitle}[\\s\\S]*?(?=## |$)`, "g");
    return existingExamplesRegex.test(markdown)
        ? markdown.replace(existingExamplesRegex, examplesSection)
        : markdown + "\n" + examplesSection;
}
/**
 * Main processing function
 */
async function processMarkdownFiles(options) {
    try {
        // Find all test and markdown files
        const testFiles = await fg.default(options.testGlob, { absolute: true });
        const markdownFiles = await fg.default(options.markdownGlob, { absolute: true });
        console.log(`Found ${testFiles.length} test files and ${markdownFiles.length} markdown files`);
        // Process each markdown file
        for (const markdownFile of markdownFiles) {
            try {
                if (!existsSync(markdownFile)) {
                    console.warn(`Markdown file not found: ${markdownFile}`);
                    continue;
                }
                const testFile = findTestFileForMarkdown(markdownFile, testFiles);
                if (!testFile) {
                    console.log(`No matching test file found for ${basename(markdownFile)}`);
                    continue;
                }
                // Extract test examples with full context
                const testCode = readFileSync(testFile, "utf-8");
                let testExamples = extractTestCases(testCode, testFile);
                // Format code if enabled
                if (options.formatCode) {
                    testExamples = await Promise.all(testExamples.map(async (example) => ({
                        ...example,
                        code: (await formatCode(example.code)).trim(),
                    })));
                }
                // Inject into markdown
                if (testExamples.length > 0) {
                    const markdownContent = readFileSync(markdownFile, "utf-8");
                    const updatedContent = injectExamples(markdownContent, testExamples, options);
                    writeFileSync(markdownFile, updatedContent, "utf-8");
                    console.log(`Updated ${basename(markdownFile)} with ${testExamples.length} examples`);
                }
            }
            catch (error) {
                console.error(`Error processing ${markdownFile}:`, error);
            }
        }
    }
    catch (error) {
        console.error("Error in processMarkdownFiles:", error);
    }
}
// Example usage
(async () => {
    await processMarkdownFiles({
        testGlob: ["projects/libraries/streamix/src/tests/*.spec.ts"],
        markdownGlob: ["docs/api/**/*.md"],
        examplesTitle: "Examples",
        maxExamples: 2,
        formatCode: true,
    });
})();
//# sourceMappingURL=index.js.map
