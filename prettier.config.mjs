/** @type {import("prettier").Config} */
const config = {
  printWidth: 100,
  trailingComma: "all",
  tailwindStylesheet: "./src/app/globals.css",
  plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
