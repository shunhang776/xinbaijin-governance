import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.js", "test/**/*.spec.js"],
		exclude: [
			"_extract/**",
			"node_modules/**",
			"coverage/**",
			"reports/**",
			"stryker-tmp/**",
		],
	},
});
