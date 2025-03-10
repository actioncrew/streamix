import { exec } from 'child_process';
import fs from 'fs';
import pkg from 'glob';
import path from 'path';
import util from 'util';
const { glob } = pkg;

const globAsync = util.promisify(glob);

// Read jasmine.config.mjs
const configModule = await import('./jasmine.config.mjs');
const config = configModule.default;

async function generateHtmlFile() {
    try {
        // Resolve source files from config using glob
        const srcFilesFromConfig = (await Promise.all(
            config.srcFiles.map(async (file) => {
                const globPattern = path.join(config.srcDir, file); // Construct full glob pattern
                return await globAsync(globPattern); // Resolve glob pattern into file paths
            })
        )).flat();

        // Resolve spec files from config using glob
        const specFilesFromConfig = (await Promise.all(
            config.specFiles.map(async (file) => {
                const globPattern = path.join(config.specDir, file);
                return await globAsync(globPattern);
            })
        )).flat();

        // Generate import map
        const importMap = {
            imports: {}
        };

        srcFilesFromConfig.forEach(file => {
            const relativePath = path.relative(config.srcDir, file).replace(/\\/g, '/').replace(/\.js$/, '');
            importMap.imports[`${relativePath}`] = `./${path.relative(config.srcDir, file).replace(/\\/g, '/')}`;
        });

        specFilesFromConfig.forEach(file => {
            const relativePath = path.relative(config.specDir, file).replace(/\\/g, '/').replace(/\.js$/, '');
            importMap.imports[`${relativePath}`] = `./${path.relative(config.specDir, file).replace(/\\/g, '/')}`;
        });

        const importMapJson = JSON.stringify(importMap, null, 2);

        // Construct import paths relative to srcDir
        const srcImportsFromConfig = srcFilesFromConfig
            .map((file) => {
                const relativePath = path
                    .relative(config.srcDir, file)
                    .replace(/\\/g, "/").replace(/\.js$/, '');
                return `import "${relativePath}";`;
            })
            .join("\n");

        // Construct import paths relative to specDir
        const specImportsFromConfig = specFilesFromConfig
            .map((file) => {
                const relativePath = path
                    .relative(config.specDir, file)
                    .replace(/\\/g, "/").replace(/\.js$/, '');
                return `import "${relativePath}";`;
            })
            .join("\n");

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Minimal Jasmine Example</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jasmine/5.0.0/jasmine.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jasmine/5.0.0/jasmine.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jasmine/5.0.0/jasmine-html.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jasmine/5.0.0/boot0.min.js"></script>
</head>
<body>
    <div class="jasmine_html-reporter">
        <div class="jasmine-banner"></div>
        <div class="jasmine-summary"></div>
        <div class="jasmine-results"></div>
        <div class="jasmine-status"></div>
    </div>
    <script type="importmap">
    ${importMapJson}
    </script>
    <script type="module">
        ${srcImportsFromConfig}
        ${specImportsFromConfig}
        import "https://cdnjs.cloudflare.com/ajax/libs/jasmine/5.0.0/boot1.min.js";
    </script>
</body>
</html>
        `;

        const srcDirPath = config.srcDir; // Assuming srcDir has at least one entry
        const absoluteSrcDirPath = path.resolve(process.cwd(), srcDirPath);
        const indexHtmlPath = path.join(absoluteSrcDirPath, 'index.html');

        // Copy index.html to src folder
        fs.writeFileSync(indexHtmlPath, htmlContent, 'utf8');
        console.log('index.html generated and copied to src folder successfully!');

        // Start http-server from src folder
        const httpServerProcess = exec(`npx http-server -p 8080 --cors`, { cwd: absoluteSrcDirPath }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error starting http-server: ${error}`);
                return;
            }
            console.log(`http-server started on port 8080 from ${absoluteSrcDirPath}`);
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
        });

        httpServerProcess.on('exit', (code) => {
            console.log(`http-server exited with code ${code}`);
        });

    } catch (error) {
        console.error('Error generating index.html:', error);
    }
}

generateHtmlFile();

