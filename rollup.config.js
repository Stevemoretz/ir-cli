import {nodeResolve} from "@rollup/plugin-node-resolve";
import nodePolyfills from "rollup-plugin-polyfill-node";
import sourcemaps from "rollup-plugin-sourcemaps";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import external from "@yelo/rollup-node-external";
import {preserveShebangs} from "rollup-plugin-preserve-shebangs";
import fs from "fs/promises";
import dts from "rollup-plugin-dts";
import {terser} from "rollup-plugin-terser";
import fsNoPromise from "fs";
import notify from "rollup-plugin-notify";

const PRODUCTION =
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";

const io = [
    "ir-cli",
];
const dtsFix = () => ({
    writeBundle: async () => {
        if (PRODUCTION) {
            await fs.rm("./dist/types-tmp", {
                recursive: true,
                force: true,
            });
        }
        const path = fsNoPromise.existsSync("./dist/dist/dist/types-tmp")
            ? "./dist/dist/dist/types-tmp"
            : "./dist/dist";
        for (const item of await fs.readdir(path, {
            withFileTypes: true,
        })) {
            if (item.isFile()) {
                await fs.rename(
                    `${path}/${item.name}`,
                    `./dist/${item.name}`.replace("d.d.ts", "d.ts")
                );
            }
        }
        await fs.rm("./dist/dist", {
            recursive: true,
            force: true,
        });
    },
});
export default [
    io.map((item) => ({
        input: `src/${item}.ts`,
        plugins: [
            nodeResolve(),
            nodePolyfills(),
            commonjs(),
            ...(!PRODUCTION ? [sourcemaps()] : []),
            typescript({
                useTsconfigDeclarationDir: true,
                clean: true,
                tsconfigOverride: {
                    compilerOptions: {
                        declarationDir: "./dist/types-tmp",
                        sourceMap: !PRODUCTION,
                    },
                },
            }),
            preserveShebangs(),
            ...(PRODUCTION ? [terser()] : []),
            notify(),
        ],
        external: external(),
        output: [
            {
                file: `dist/${item}.js`,
                format: "es",
                sourcemap: !PRODUCTION,
                globals: [],
            },
        ],
    })),
    [
        {
            input: io.map((item) => `dist/types-tmp/${item}.d.ts`),
            output: [{dir: `./dist/dist`, format: "es"}],
            watch: true,
            plugins: [dts(), dtsFix(), notify()],
        },
    ],
].flat();
