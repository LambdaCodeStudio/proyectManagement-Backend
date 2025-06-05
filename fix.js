#!/usr/bin/env node

/**
 * Script para corregir el uso de new ObjectId() a new ObjectId() en el proyecto
 * 
 * Uso: node fix-objectid.js
 */

const fs = require('fs');
const path = require('path');

// Colores para el console.log
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = {
  error: (msg) => console.log(colors.red + '❌ ' + msg + colors.reset),
  success: (msg) => console.log(colors.green + '✅ ' + msg + colors.reset),
  warning: (msg) => console.log(colors.yellow + '⚠️ ' + msg + colors.reset),
  info: (msg) => console.log(colors.blue + 'ℹ️ ' + msg + colors.reset),
  step: (msg) => console.log(colors.cyan + '🔧 ' + msg + colors.reset)
};

// Patrones a buscar y reemplazar
const patterns = [
  {
    name: 'new ObjectId() sin new',
    search: /(?<!new\s)ObjectId\s*\(/g,
    replace: 'new ObjectId(',
    description: 'Agregar "new" antes de new ObjectId()'
  },
  {
    name: 'mongoose.Types.new ObjectId() sin new',
    search: /(?<!new\s)mongoose\.Types\.ObjectId\s*\(/g,
    replace: 'new mongoose.Types.new ObjectId(',
    description: 'Agregar "new" antes de mongoose.Types.new ObjectId()'
  },
  {
    name: 'Types.new ObjectId() sin new',
    search: /(?<!new\s)Types\.ObjectId\s*\(/g,
    replace: 'new Types.new ObjectId(',
    description: 'Agregar "new" antes de Types.new ObjectId()'
  }
];

// Verificar si falta importar ObjectId
const importPatterns = [
  {
    check: /ObjectId\s*\(/,
    requiredImport: "const { ObjectId } = require('mongoose').Types;",
    description: 'Importar ObjectId de mongoose.Types'
  }
];

// Extensiones de archivo a procesar
const extensions = ['.js', '.ts'];

// Directorios a evitar
const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

/**
 * Obtener todos los archivos JavaScript/TypeScript del directorio
 */
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Evitar directorios excluidos
      if (!excludeDirs.includes(file)) {
        getAllFiles(fullPath, fileList);
      }
    } else if (extensions.includes(path.extname(file))) {
      fileList.push(fullPath);
    }
  });

  return fileList;
}

/**
 * Analizar un archivo y buscar patrones problemáticos
 */
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    // Buscar patrones problemáticos
    patterns.forEach(pattern => {
      const matches = content.match(pattern.search);
      if (matches) {
        issues.push({
          type: 'pattern',
          pattern: pattern.name,
          description: pattern.description,
          matches: matches.length,
          lines: getLineNumbers(content, pattern.search)
        });
      }
    });

    // Verificar importaciones faltantes
    importPatterns.forEach(importPattern => {
      if (content.match(importPattern.check)) {
        // Verificar si ya tiene la importación
        if (!content.includes('ObjectId') || 
            (!content.includes('mongoose.Types') && 
             !content.includes("require('mongoose').Types") &&
             !content.includes('from \'mongoose\''))) {
          issues.push({
            type: 'import',
            description: importPattern.description,
            requiredImport: importPattern.requiredImport
          });
        }
      }
    });

    return issues;
  } catch (error) {
    log.error(`Error leyendo archivo ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Obtener números de línea donde aparece un patrón
 */
function getLineNumbers(content, pattern) {
  const lines = content.split('\n');
  const lineNumbers = [];

  lines.forEach((line, index) => {
    if (line.match(pattern)) {
      lineNumbers.push(index + 1);
    }
  });

  return lineNumbers;
}

/**
 * Corregir un archivo
 */
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Aplicar correcciones de patrones
    patterns.forEach(pattern => {
      const originalContent = content;
      content = content.replace(pattern.search, pattern.replace);
      if (content !== originalContent) {
        modified = true;
        log.success(`  Aplicado: ${pattern.description}`);
      }
    });

    // Verificar y agregar importaciones si es necesario
    importPatterns.forEach(importPattern => {
      if (content.match(importPattern.check)) {
        if (!content.includes('ObjectId') || 
            (!content.includes('mongoose.Types') && 
             !content.includes("require('mongoose').Types"))) {
          
          // Agregar importación al inicio del archivo
          const lines = content.split('\n');
          let insertIndex = 0;
          
          // Buscar un buen lugar para insertar (después de otros requires)
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('require(') || lines[i].includes('import ')) {
              insertIndex = i + 1;
            } else if (lines[i].trim() === '') {
              continue;
            } else {
              break;
            }
          }
          
          lines.splice(insertIndex, 0, importPattern.requiredImport);
          content = lines.join('\n');
          modified = true;
          log.success(`  Agregada importación: ${importPattern.description}`);
        }
      }
    });

    // Guardar archivo si fue modificado
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }

    return false;
  } catch (error) {
    log.error(`Error corrigiendo archivo ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Función principal
 */
function main() {
  const startTime = Date.now();
  
  log.step('Iniciando corrección de ObjectId en el proyecto...');
  
  // Obtener directorio actual
  const projectDir = process.cwd();
  log.info(`Analizando directorio: ${projectDir}`);

  // Obtener todos los archivos
  const files = getAllFiles(projectDir);
  log.info(`Encontrados ${files.length} archivos para analizar`);

  let totalIssues = 0;
  let fixedFiles = 0;
  const problemFiles = [];

  // Analizar cada archivo
  files.forEach(filePath => {
    const relativePath = path.relative(projectDir, filePath);
    const issues = analyzeFile(filePath);

    if (issues.length > 0) {
      totalIssues += issues.length;
      problemFiles.push({ path: relativePath, issues });
      
      log.warning(`Problemas en: ${relativePath}`);
      issues.forEach(issue => {
        if (issue.type === 'pattern') {
          log.info(`  - ${issue.pattern}: ${issue.matches} ocurrencias en líneas ${issue.lines.join(', ')}`);
        } else if (issue.type === 'import') {
          log.info(`  - ${issue.description}`);
        }
      });
    }
  });

  if (totalIssues === 0) {
    log.success('¡No se encontraron problemas de ObjectId!');
    return;
  }

  log.step(`\nEncontrados ${totalIssues} problemas en ${problemFiles.length} archivos`);
  
  // Preguntar si aplicar correcciones
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n¿Desea aplicar las correcciones automáticamente? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      log.step('\nAplicando correcciones...');
      
      problemFiles.forEach(({ path: filePath }) => {
        const fullPath = path.join(projectDir, filePath);
        log.step(`Corrigiendo: ${filePath}`);
        
        if (fixFile(fullPath)) {
          fixedFiles++;
          log.success(`  ✓ Archivo corregido`);
        } else {
          log.info(`  - Sin cambios necesarios`);
        }
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      log.success(`\n🎉 Proceso completado en ${duration}s`);
      log.success(`📊 Estadísticas:`);
      log.success(`   - Archivos analizados: ${files.length}`);
      log.success(`   - Archivos con problemas: ${problemFiles.length}`);
      log.success(`   - Archivos corregidos: ${fixedFiles}`);
      log.success(`   - Problemas encontrados: ${totalIssues}`);
      
      log.step('\n📋 Pasos siguientes:');
      log.info('1. Revisar los cambios con git diff');
      log.info('2. Ejecutar las pruebas: npm test');
      log.info('3. Reiniciar el servidor: npm start');
      
    } else {
      log.info('Correcciones canceladas por el usuario');
      log.step('\n📋 Para corregir manualmente:');
      problemFiles.forEach(({ path: filePath, issues }) => {
        log.info(`\n📄 ${filePath}:`);
        issues.forEach(issue => {
          if (issue.type === 'pattern') {
            log.info(`   - Reemplazar: ${issue.pattern}`);
          } else if (issue.type === 'import') {
            log.info(`   - Agregar: ${issue.requiredImport}`);
          }
        });
      });
    }
    
    rl.close();
  });
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { main, analyzeFile, fixFile };