import chalk from "chalk";
import {program} from "commander";
import {lemmatizer} from "lemmatizer";

const stopWords = [
    "a",
    "all",
    "an",
    "and",
    "any",
    "are",
    "as",
    "be",
    "been",
    "but",
    "by",
    "few",
    "for",
    "have",
    "he",
    "her",
    "here",
    "him",
    "his",
    "how",
    "i",
    "in",
    "is",
    "it",
    "its",
    "many",
    "me",
    "my",
    "none",
    "of",
    "on",
    "or",
    "our",
    "she",
    "some",
    "the",
    "their",
    "them",
    "there",
    "they",
    "that",
    "this",
    "us",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "will",
    "with",
    "you",
    "your",
];

export const processString = (doc: string) => {
    let inHeader = false;
    return doc
        .replace("\n", " ")
        .split(/[,\.\s'"]/gm)
        .filter((item) => !stopWords.includes(item) && item)
        .map((item) => {
            let tempInHeader: null | boolean = null;
            if (item.includes("<header>")) {
                inHeader = true;
                item = item.replace("<header>", "");
            }
            if (item.includes("</header>")) {
                tempInHeader = false;
                item = item.replace("</header>", "");
            }
            item = lemmatizer(item);
            item = item.toLowerCase();
            const result = inHeader ? "header." + item : item;
            if (tempInHeader !== null) {
                inHeader = tempInHeader;
            }
            return result;
        });
};

export const getTokens = (docId: number, doc: string) => {
    return processString(doc).map((term, index) => ({
        term: term,
        docId: docId,
        index: index,
    }));
};

export const combinedNormalIndex = (docs: string[]) => {
    return docs
        .reduce<{term: string; docId: number}[]>((prev, current, index) => {
            return [...prev, ...getTokens(index + 1, current)];
        }, [])
        .sort((a, b) => {
            const sort1 = a.term.localeCompare(b.term);
            if (!sort1) {
                return a.docId - b.docId;
            }
            return sort1;
        });
};

export const buildNormalIndex = (docs: string[]) => {
    return combinedNormalIndex(docs).reduce<{[term: string]: number[]}>(
        (prev, current) => {
            const strings = current.term.split(".");
            const term = strings[strings.length - 1];
            return {
                ...prev,
                [term]: [...(prev[term] || []), current.docId].sort(
                    (a, b) => a - b
                ),
            };
        },
        {}
    );
};

export const buildPositionalIndex = (docs: string[]) => {
    return combinedNormalIndex(docs).reduce<{
        [term: string]: {[key: number]: number[]};
    }>((prev, current) => {
        return {
            ...prev,
            [current.term]: {
                ...(prev[current.term] || []),
                [current.docId]: [
                    ...(prev?.[current.term]?.[current.docId] || []),
                    current["index"],
                ].sort((a, b) => a - b),
            },
        };
    }, {});
};

export const queryWithNormalIndex = (
    terms: string[],
    index: {[key: string]: number[]},
    term2PostingList: number[] = []
) => {
    const term1 = terms.shift() as string;
    const term2 = terms.shift() as string;
    if (!term1 || (!term2 && term2PostingList.length === 0)) {
        console.log(
            chalk.red(
                "Error : A boolean query requires at least two arguments."
            )
        );
        process.exit(0);
    }

    const term1PostingList = index[term1] || [];
    term2PostingList =
        (term2PostingList.length > 0 && term2PostingList) || index[term2] || [];
    const results: number[] = [];
    let i = 0;
    let j = 0;
    while (term1PostingList.length > i && term2PostingList.length > j) {
        const itemTop = term1PostingList[i];
        const itemBottom = term2PostingList[j];
        if (itemTop === itemBottom) {
            results.push(itemTop);
            j++;
            i++;
        } else if (itemTop > itemBottom) {
            j++;
        } else if (itemTop < itemBottom) {
            i++;
        }
    }

    if (terms.length > 0 && results.length > 0) {
        return queryWithNormalIndex(terms, index, results);
    }

    return results;
};

export const queryWithNormalIndexViaSkipPointers = (
    terms: string[],
    index: {[key: string]: number[]},
    term2PostingList: number[] = [],
    skipBy = 3
) => {
    const term1 = terms.shift() as string;
    const term2 = terms.shift() as string;
    if (!term1 || (!term2 && term2PostingList.length === 0)) {
        console.log(
            chalk.red(
                "Error : A boolean query requires at least two arguments."
            )
        );
        process.exit(0);
    }

    const term1PostingList = index[term1] || [];
    term2PostingList =
        (term2PostingList.length > 0 && term2PostingList) || index[term2] || [];
    const results: number[] = [];
    let i = 0;
    let j = 0;
    while (term1PostingList.length > i && term2PostingList.length > j) {
        const itemTop = term1PostingList[i];
        const itemBottom = term2PostingList[j];
        if (itemTop === itemBottom) {
            results.push(itemTop);
            j++;
            i++;
        } else if (itemTop > itemBottom) {
            if (
                j % skipBy === 0 &&
                term2PostingList.length > j + skipBy &&
                term2PostingList[j + skipBy] <= itemTop
            ) {
                j = j + skipBy;
                if (term2PostingList[j + skipBy] === itemTop) {
                    results.push(itemBottom);
                    j++;
                    i++;
                }
            } else {
                j++;
            }
        } else if (itemTop < itemBottom) {
            if (
                i % skipBy === 0 &&
                term1PostingList.length > i + skipBy &&
                term1PostingList[i + skipBy] <= itemBottom
            ) {
                i = i + skipBy;
                if (term1PostingList[i + skipBy] === itemBottom) {
                    results.push(itemTop);
                    j++;
                    i++;
                }
            } else {
                i++;
            }
        }
    }

    if (terms.length > 0 && results.length > 0) {
        return queryWithNormalIndex(terms, index, results);
    }

    return results;
};

export const queryWithPositionalIndex = (
    terms: string[],
    index: {[p: string]: {[p: number]: number[]}}
) => {
    const term1 = terms.shift() as string;
    const term2 = terms.shift() as string;
    if (!term1 || !term2) {
        console.log(
            chalk.red(
                "Error : A boolean query requires at least two arguments."
            )
        );
        process.exit(0);
    }

    const term1PostingList = Object.keys(index[term1] || []);
    const term2PostingList = Object.keys(index[term2] || []);
    // (term2PostingList.length > 0 && term2PostingList) || index[term2] || [];
    let results: {[key: string]: number[]} = {};
    let i = 0;
    let j = 0;
    while (term1PostingList.length > i && term2PostingList.length > j) {
        const itemTop = parseInt(term1PostingList[i]);
        const itemBottom = parseInt(term2PostingList[j]);
        if (itemTop === itemBottom) {
            const indices = index[term1][itemTop]
                .filter((item) => index[term2][itemBottom].includes(item + 1))
                .map((item) => item + 1);
            if (indices.length > 0) {
                results = {
                    ...results,
                    [itemTop]: indices,
                };
            }
            j++;
            i++;
        } else if (itemTop > itemBottom) {
            j++;
        } else if (itemTop < itemBottom) {
            i++;
        }
    }

    return results;
};

export const positionalIndexRanking = (
    result: {[p: string]: number[]},
    index: {[p: string]: {[p: number]: number[]}},
    weightLessIndex: {[p: string]: {[p: number]: number[]}}
) => {
    return Object.keys(result)
        .map((docId) => {
            const positions = result[docId];
            const score = positions.reduce((prev, value) => {
                const pos1 = value - 1;
                const pos2 = value;
                return (
                    prev +
                    [pos1, pos2].reduce((prev, pos) => {
                        const term =
                            Object.keys(index).find(
                                (key) =>
                                    index[key]?.[docId.toString()]?.find(
                                        (i) => i == pos
                                    ) >= 0
                            ) || "";
                        const strings = term.split(".");
                        let weight = 0.2;
                        if (strings[0] === "header") {
                            weight = 0.8;
                        }

                        const refinedTerm = strings[strings.length - 1];
                        const df = Object.keys(
                            weightLessIndex[refinedTerm]
                        ).length;
                        const N = weightLessIndex[refinedTerm][docId].length;
                        return prev + Math.log(N / df) * weight;
                    }, 0)
                );
            }, 0);
            return {
                docId,
                score,
            };
        })
        .sort((a, b) => b.score - a.score);
};
