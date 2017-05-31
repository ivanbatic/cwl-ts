import {expect} from "chai";
import {V1CommandLineToolModel} from "./V1CommandLineToolModel";
import {CommandLineTool} from "../../mappings/v1.0/CommandLineTool";
import {CommandLinePart} from "../helpers/CommandLinePart";
import {ExpressionEvaluator} from "../helpers/ExpressionEvaluator";
import {JSExecutor} from "../helpers/JSExecutor";

function runTest(app: CommandLineTool, job: any, expected: CommandLinePart[], done) {
    let model = new V1CommandLineToolModel(app, "document");
    model.setJobInputs(job);
    model.setRuntime({"cores": 4});
    model.generateCommandLineParts().then((result) => {
        let resStr = result.map(
            (part) => {
                return part.value
            }
        ).filter((part) => {
            return part !== ""
        });

        expect(resStr.join(" ")).to.equals(expected.join(" "));
    }).then(done, done);
}

function makeTests(specPath: string) {
    const YAML    = require("js-yaml");
    const fs      = require("fs");
    const path    = require('path');
    const spec    = fs.readFileSync(specPath);
    let tests     = YAML.safeLoad(spec);
    let testsRoot = path.dirname(specPath);

    for (let test of tests) {
        it("should pass " + test["doc"], (done) => {
            let tool = YAML.safeLoad(fs.readFileSync(path.join(testsRoot, test["tool"])));
            let job  = YAML.safeLoad(fs.readFileSync(path.join(testsRoot, test["job"])));
            runTest(tool, job, test["output"], done);
        });
    }

}

describe("V1CommandLineToolModel", () => {
    describe("generateCommandLineParts conformance", () => {
        const path     = require('path');
        const specPath = path.join(__dirname, '../../../src/tests/cli-conformance/conformance-test-v1.yaml');
        makeTests(specPath);
    });

    describe("serialize", () => {
        let model: V1CommandLineToolModel;

        beforeEach(() => {
            model                                  = new V1CommandLineToolModel(<any> {});
            ExpressionEvaluator.evaluateExpression = JSExecutor.evaluate;
        });

        it("should serialize baseCommand that is defined", () => {
            model.addBaseCommand("grep");
            const serialized = model.serialize();

            expect(serialized.baseCommand).to.have.length(1);
            expect(serialized.baseCommand).to.deep.equal(["grep"]);
        });

        it("should serialize baseCommand that is blank", () => {
            model.addBaseCommand();
            const serialized = model.serialize();

            expect(serialized.baseCommand).to.have.length(0);
            expect(serialized.baseCommand).to.deep.equal([]);
        });


    });

    describe("jobManagement", () => {
        it("should add mock input to job when adding input", () => {
            const model = new V1CommandLineToolModel(<any> {});

            expect(model.getContext().inputs).to.be.empty;

            model.addInput({
                id: "input",
                type: "string"
            });

            const context = model.getContext();
            expect(context.inputs).to.not.be.empty;
            expect(typeof context.inputs.input).to.equal("string");
        });

        it("should remove job value when removing input", () => {
            const model = new V1CommandLineToolModel(<any> {
                inputs: {
                    input: "string"
                }
            });

            expect(model.getContext().inputs).to.have.all.keys("input");

            model.removeInput(model.inputs[0]);
            expect(model.getContext().inputs).to.deep.equal({});
        });

        it("should change job value when changing input items type", () => {
            const model = new V1CommandLineToolModel(<any> {
                inputs: {
                    input: "File[]"
                }
            });

            const context = model.getContext();

            expect(typeof context.inputs.input[0]).to.equal("object");

            model.inputs[0].type.items = "int";

            expect(typeof context.inputs.input[0]).to.equal("number");
        });

        it("should change job value when changing input type", () => {
            const model = new V1CommandLineToolModel(<any> {
                inputs: {
                    input: "string"
                }
            });

            const context = model.getContext();

            expect(typeof context.inputs.input).to.equal("string");

            model.inputs[0].type.type = "int";

            expect(typeof context.inputs.input).to.equal("number");
        });

        it("should change job key when changing input id", () => {
            const model = new V1CommandLineToolModel(<any> {
                inputs: {
                    input: "string"
                }
            });

            const context = model.getContext();
            expect(context.inputs).to.have.all.keys("input");
            expect(typeof context.inputs.input).to.equal("string");

            expect(context.inputs.newId).to.be.undefined;
            expect(context.inputs.input).to.not.be.undefined;

            model.changeIOId(model.inputs[0], "newId");

            expect(context.inputs.input).to.be.undefined;
            expect(context.inputs.newId).to.not.be.undefined;

        });
    });

    describe("ShellCommandRequirement", () => {
        it("should add ShellCommandRequirement if an argument has shellQuote: true", () => {
            const tool = new V1CommandLineToolModel(<any> {
                arguments: [
                    {
                        prefix: "b",
                        valueFrom: "string",
                        shellQuote: true
                    }
                ]
            });

            const serialize = tool.serialize();
            expect(serialize.requirements).to.not.be.empty;
            expect(serialize.requirements).to.have.length(1);
            expect(serialize.requirements[0].class).to.equal("ShellCommandRequirement");
        });

        it("should add ShellCommandRequirement if an input has shellQuote: true", () => {
            const tool = new V1CommandLineToolModel(<any> {
                inputs: {
                    first: {
                        type: "string",
                        inputBinding: {
                            prefix: "a",
                            shellQuote: true
                        }
                    }
                }
            });

            const serialize = tool.serialize();
            expect(serialize.requirements).to.not.be.empty;
            expect(serialize.requirements).to.have.length(1);
            expect(serialize.requirements[0].class).to.equal("ShellCommandRequirement");
        });

        it("should add ShellCommandRequirement if field has shellQuote: true", () => {
            const tool = new V1CommandLineToolModel(<any> {
                inputs: {
                    first: {
                        type: {
                            type: "record",
                            fields: {
                                field: {
                                    type: "string",
                                    inputBinding: {
                                        shellQuote: true
                                    }
                                }
                            }
                        },
                        inputBinding: {
                            prefix: "a"
                        }
                    }
                }
            });

            const serialize = tool.serialize();
            expect(serialize.requirements).to.not.be.empty;
            expect(serialize.requirements).to.have.length(1);
            expect(serialize.requirements[0].class).to.equal("ShellCommandRequirement");
        });

        it("should not add ShellQuoteRequirement if no binding has shellQuote: true", () => {
            const tool = new V1CommandLineToolModel(<any> {
                inputs: {
                    first: "string",
                    second: {
                        type: "string",
                        inputBinding: {
                            prefix: "a"
                        }
                    }
                },
                arguments: [
                    {
                        prefix: "b",
                        valueFrom: "string"
                    }
                ]
            });

            const serialize = tool.serialize();
            expect(serialize.requirements).to.be.empty;
        });
    });

    describe("validation", () => {
        it("should be invalid if inputs have duplicate id", (done) => {
            const model = new V1CommandLineToolModel(<any> {
                inputs: [
                    {id: "dup", type: "string"},
                    {id: "dup", type: "int"}
                ]
            });

            model.validate().then(() => {
                const errors = model.filterIssues();
                expect(errors).to.not.be.empty;
                expect(errors).to.have.length(1);
                expect(errors[0].loc).to.equal("document.inputs[1].id");
            }).then(done, done);
        });

        it("should be invalid if outputs have duplicate id", (done) => {
            const model = new V1CommandLineToolModel(<any> {
                outputs: [
                    {id: "dup", type: "string"},
                    {id: "dup", type: "int"}
                ]
            });

            model.validate().then(() => {
                const errors = model.filterIssues();
                expect(errors).to.not.be.empty;
                expect(errors).to.have.length(1);
                expect(errors[0].loc).to.equal("document.outputs[1].id");
            }).then(done, done);
        });

        it("should be invalid if stdin expression is invalid", (done) => {
            const model = new V1CommandLineToolModel(<any> {
                stdin: "${!!!}"
            });

            model.validate().then(() => {
                const errors = model.filterIssues();
                expect(errors).to.not.be.empty;
                expect(errors).to.have.length(1);
                expect(errors[0].loc).to.equal("document.stdin");

                expect(model.stdin.errors).to.not.be.empty;
                expect(model.stdin.errors).to.have.length(1);
                expect(model.stdin.errors[0].loc).to.equal("document.stdin");
            }).then(done, done);
        });

        it("should be invalid if stdout expression is invalid", (done) => {
            const model = new V1CommandLineToolModel(<any> {
                stdout: "${!!!}"
            });

            model.validate().then(() => {
                expect(model.errors).to.not.be.empty;
                expect(model.errors).to.have.length(1);
                expect(model.errors[0].loc).to.equal("document.stdout");
            }).then(done, done);

        });
    });
});
