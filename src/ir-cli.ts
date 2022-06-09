#!/usr/bin/env node
import chalk from "chalk";
import clear from "clear";
import {program} from "commander";
import merge from "deepmerge";
import figlet from "figlet";
import * as fs from "fs";
import inquirer from "inquirer";
import path from "path";
import {getDirname} from "./currentDir";
import {
    buildNormalIndex,
    buildPositionalIndex,
    positionalIndexRanking,
    processString,
    queryWithNormalIndex,
    queryWithNormalIndexViaSkipPointers,
    queryWithPositionalIndex,
} from "./utils";
import type {KeyDescriptor} from "inquirer-press-to-continue";
import PressToContinuePrompt from "inquirer-press-to-continue";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

program.version("1.0.0");
program.parse(process.argv);
clear();
console.log(
    chalk.bgCyan(figlet.textSync("IR CLI", {horizontalLayout: "full"}))
);

const anyKeyWait = async (title: string) => {
    await inquirer.prompt<{key: KeyDescriptor}>({
        name: "confirm",
        type: "press-to-continue",
        anyKey: true,
        pressToContinueMessage: title + "\n",
    });
};

const exit = (code = 0) => {
    console.log(chalk.yellow("Okay, Bye 👋!"));
    process.exit(code);
};
const cwd = path.resolve("./");
const getFilePaths = async () => {
    const paths = fs
        .readdirSync(cwd, {withFileTypes: true})
        .filter((value) => value.isFile())
        .map((value) => cwd + "/" + value.name)
        .filter((item) => path.extname(item) === ".txt");
    if (paths.length === 0) {
        if (
            (
                await inquirer.prompt([
                    {
                        message:
                            "You don't have any .txt files in the current folder, do you want me to add a few samples for you?",
                        name: "confirm",
                        type: "confirm",
                    },
                ])
            ).confirm
        ) {
            const demoPath = getDirname() + "/../demo";
            const demoPaths = fs.readdirSync(demoPath);
            demoPaths.forEach((p) => {
                fs.copyFileSync(
                    demoPath + "/" + p,
                    cwd + "/" + path.basename(p)
                );
            });
            return paths;
        } else {
            exit();
        }
    }
    return paths;
};

console.log(chalk.green("# STEP 1 -> finding docs"));
const paths = await getFilePaths();
if (paths) {
    paths.forEach((item, index) => {
        console.log(
            `Found document ${chalk.blue(
                path.basename(item)
            )} with id : ${chalk.blue(index + 1)}`
        );
    });
}
const contents = paths.map((item) => {
    return fs.readFileSync(item, {encoding: "utf8"});
});
const query = (
    await inquirer.prompt([
        {
            type: "input",
            name: "query",
            message: "Please enter your query",
            validate(input: any) {
                if (input) {
                    const andCount =
                        input.toLowerCase().split("and").length - 1;
                    if (andCount > 1) {
                        return `Please use only one And because our positional index module does not yet support more than one and.\n${chalk.blue(
                            "eg : hello and hi"
                        )}`;
                    } else if (andCount === 0) {
                        return "eg : hello and hi";
                    }
                } else {
                    return "Please enter something!";
                }
                return true;
            },
        },
    ])
).query;
const realAnswers = (
    await inquirer.prompt([
        {
            type: "input",
            name: "answers",
            message: `Please enter the real answer of docIds (for calculating the ${chalk.blue(
                "precision"
            )} and ${chalk.blue("recall")})`,
            validate(input: any) {
                if (!/^(?:\d+,)*\d+$/gm.test(input)) {
                    return "eg : 1,3";
                }
                return true;
            },
        },
    ])
).answers
    .split(",")
    .map((item) => parseInt(item));

const printStatistics = (answer: number[]) => {
    answer = [...new Set(answer)];
    console.log(
        `${chalk.green("found docIds")}: ${chalk.blue(answer.join(", "))}`
    );
    const matchedCount = answer.reduce((prev, current) => {
        if (realAnswers.includes(current)) {
            prev++;
        }
        return prev;
    }, 0);
    console.log(
        `${chalk.green("precision")}: ${chalk.blue(
            `${((matchedCount / answer.length) * 100).toLocaleString()}%`
        )}`
    );
    console.log(
        `${chalk.green("recall")}: ${chalk.blue(
            `${((matchedCount / realAnswers.length) * 100).toLocaleString()}%`
        )}`
    );
};

const searchPositingLists = async () => {
    console.log(chalk.green("# STEP 2 -> search via posting lists"));

    await anyKeyWait("Press any key to show posting lists");
    const index = buildNormalIndex(contents);
    console.log("Posting Lists : ", index);

    await anyKeyWait("Press any key to show the answer");
    const q = processString(query);
    printStatistics(queryWithNormalIndex(q, index));
};
const searchPositingListsViaSkipPointers = async () => {
    console.log(
        chalk.green(
            "# STEP 3 -> search via posting lists with " +
                chalk.blue("skip pointers")
        )
    );

    await anyKeyWait("Press any key to show posting lists");
    const index = buildNormalIndex(contents);
    console.log("Posting Lists : ", index);

    await anyKeyWait("Press any key to show the answer");
    const q = processString(query);
    printStatistics(queryWithNormalIndexViaSkipPointers(q, index));
};
const searchPositingListsWithPositionalIndexes = async () => {
    console.log(
        chalk.green(
            "# STEP 4 -> search via posting lists with " +
                chalk.blue("positional index")
        )
    );

    await anyKeyWait("Press any key to show posting lists");
    const index = buildPositionalIndex(contents);
    console.log("Posting Lists : ", index);

    await anyKeyWait("Press any key to show the answer");
    const q = processString(query);
    printStatistics(
        Object.keys(queryWithPositionalIndex(q, index)).map((item) =>
            parseInt(item)
        )
    );
};
const searchPositingListsWithPositionalIndexesAndRankTheResults = async () => {
    console.log(
        chalk.green("# STEP 5 -> rank via " + chalk.blue("positional index"))
    );

    await anyKeyWait("Press any key to rank results");
    const index = buildPositionalIndex(contents);
    const q = processString(query);
    const weightLessIndex = Object.keys(index).reduce((prev, current) => {
        const strings = current.split(".");
        const term = strings[strings.length - 1];
        return {
            ...prev,
            [term]: merge(prev[term], index[current]),
        };
    }, {});
    const result = queryWithPositionalIndex([...q], weightLessIndex);
    const ranking = positionalIndexRanking(result, index, weightLessIndex);
    console.log("Rank Results : ");
    ranking
        .sort((a, b) => {
            return b.score - a.score;
        })
        .map((item, index) => {
            console.log(
                `${chalk.blue(`#${index + 1}`)} : ${chalk.green(
                    item.docId
                )} with score of ${chalk.yellow(item.score.toLocaleString())}`
            );
        });
};

await searchPositingLists();
await anyKeyWait("Press any key to go to the next step");
await searchPositingListsViaSkipPointers();
await anyKeyWait("Press any key to go to the next step");
await searchPositingListsWithPositionalIndexes();
await anyKeyWait("Press any key to go to the next step");
await searchPositingListsWithPositionalIndexesAndRankTheResults();
