// eslint.config.js
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  // 忽略构建产物和依赖目录
  {
    ignores: [
      "**/dist/*", 
      "**/node_modules/*", 
      "**/coverage/*",
      "**/build/*"
    ],
  },
  
  // 使用 TypeScript ESLint 推荐配置
  tseslint.configs.recommended,
  
  // Prettier 配置（关闭与 Prettier 冲突的规则）
  prettierConfig,
  
  // 主要配置
  {
    languageOptions: {
      globals: {
        ...globals.browser, // 浏览器环境
        ...globals.node,    // Node.js 环境
        ...globals.es2020,  // ES2020 语法
      },
      ecmaVersion: 2020,
      sourceType: "module",
    },
    
    rules: {
      // 保留您原有的自定义规则
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": "off", // Allow console logs for debugging
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  
  // Jest 测试文件的特殊配置
  {
    files: ["**/*.test.ts", "**/*.test.js", "**/*.spec.ts", "**/*.spec.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
