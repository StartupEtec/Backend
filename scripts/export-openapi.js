import fs from 'node:fs';
import path from 'node:path';
import { dump } from 'js-yaml';
import { swaggerSpec } from '../src/utils/swagger.js';

const outputDir = path.resolve('docs');
const outputPath = path.join(outputDir, 'openapi.yaml');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const yamlString = dump(swaggerSpec, {
  lineWidth: 120,
  noRefs: true,
  sortKeys: false,
  quotingType: '"',
});

fs.writeFileSync(outputPath, yamlString, 'utf-8');
console.log(`OpenAPI spec exported to ${outputPath}`);
