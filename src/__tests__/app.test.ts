import {
    buildNormalIndex,
    buildPositionalIndex,
    combinedNormalIndex,
    getTokens,
    positionalIndexRanking,
    processString,
    queryWithNormalIndex,
    queryWithNormalIndexViaSkipPointers,
    queryWithPositionalIndex,
} from "../utils";
import merge from "deepmerge";

const demo1 =
    "On his return, Caesar married Pompeia, a granddaughter of Sulla. Their marriage ended in scandal.";
const demo2 = "It was rumored that Caesar was the father of Servilia's son";
const demo3 = "son and father relationship that was an open secret at Rome.";

describe("Boolean Queries", () => {
    describe("index", () => {
        it("posting list tokens", () => {
            expect(getTokens(1, demo1)).toMatchSnapshot();
        });
        it("posting list combinedNormalIndex", () => {
            expect(
                combinedNormalIndex([demo1, demo2, demo3])
            ).toMatchSnapshot();
        });
        it("posting list index", () => {
            expect(buildNormalIndex([demo1, demo2, demo3])).toMatchSnapshot();
        });
    });

    describe("posting list query test", () => {
        it("posting list test and of two words", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father");
            expect(queryWithNormalIndex(query, index)).toEqual([2]);
        });
        it("posting list test and of non existence word", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and not_in_the_docs");
            expect(queryWithNormalIndex(query, index)).toEqual([]);
        });
        it("posting list test and of three words no match", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father and granddaughter");
            expect(queryWithNormalIndex(query, index)).toEqual([]);
        });
        it("posting list test and of three words one match", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father and it");
            expect(queryWithNormalIndex(query, index)).toEqual([2]);
        });
        it("posting list test and of three words no match but longer", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father and it and 6546546");
            expect(queryWithNormalIndex(query, index)).toEqual([]);
        });
        it("posting list test and of three words one match in many docs", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString(
                "caesar and father and it and rumor and s and son and servilia"
            );
            expect(queryWithNormalIndex(query, index)).toEqual([2]);
        });
    });

    describe("posting list query test with skip pointers", () => {
        it("posting list test and of two words", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father");
            expect(queryWithNormalIndexViaSkipPointers(query, index)).toEqual([
                2,
            ]);
        });
        it("posting list test and of non existence word", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and not_in_the_docs");
            expect(queryWithNormalIndexViaSkipPointers(query, index)).toEqual(
                []
            );
        });
        it("posting list test and of three words no match", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father and granddaughter");
            expect(queryWithNormalIndexViaSkipPointers(query, index)).toEqual(
                []
            );
        });
        it("posting list test and of three words one match", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father and it");
            expect(queryWithNormalIndexViaSkipPointers(query, index)).toEqual([
                2,
            ]);
        });
        it("posting list test and of three words no match but longer", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString("caesar and father and it and 6546546");
            expect(queryWithNormalIndexViaSkipPointers(query, index)).toEqual(
                []
            );
        });
        it("posting list test and of three words one match in many docs", () => {
            const index = buildNormalIndex([demo1, demo2, demo3]);
            const query = processString(
                "caesar and father and it and rumor and s and son and servilia"
            );
            expect(queryWithNormalIndexViaSkipPointers(query, index)).toEqual([
                2,
            ]);
        });
    });
});

const demoPositional1 = "Caesar at the wedding";
const demoPositional2 =
    "<header>And we had Caesar at the wedding</header> Caesar at";
// const demoPositional2 = "And we had Caesar at the wedding Caesar at";
const demoPositional3 = "asdds";

describe("Proximity Queries", () => {
    describe("index", () => {
        it("index", () => {
            const index = buildPositionalIndex([
                demoPositional1,
                demoPositional2,
                demoPositional3,
            ]);
            expect(index).toMatchSnapshot();
        });
    });
    describe("posting list positional query test", () => {
        it("posting list test and of two words", () => {
            const index = buildPositionalIndex([
                demoPositional1,
                demoPositional2,
                demoPositional3,
            ]);
            const query = processString("Caesar at");
            expect(Object.keys(queryWithPositionalIndex(query, index))).toEqual(
                ["1", "2"]
            );
        });
    });
    describe("posting list positional query test ranking", () => {
        it("posting list test and of two words", () => {
            const index = buildPositionalIndex([
                demoPositional1,
                demoPositional2,
                demoPositional3,
            ]);
            const query = processString("Caesar at");
            const weightLessIndex = Object.keys(index).reduce(
                (prev, current) => {
                    const strings = current.split(".");
                    const term = strings[strings.length - 1];
                    return {
                        ...prev,
                        [term]: merge(prev[term], index[current]),
                    };
                },
                {}
            );
            const result = queryWithPositionalIndex(
                [...query],
                weightLessIndex
            );

            const ranking = positionalIndexRanking(
                result,
                index,
                weightLessIndex
            );
            expect(ranking.map((item) => item.docId)).toEqual(["2", "1"]);
        });
    });
});
