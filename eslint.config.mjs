import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // 설계 문서와 벤더 참조 코드. gitignore 대상이고 빌드에도 안 들어간다.
      // 포크해서 components/ 아래로 가져오면 그때부터 정상 검사된다.
      ".claude/**",
      ".superpowers/**",
    ],
  },
];

export default eslintConfig;
