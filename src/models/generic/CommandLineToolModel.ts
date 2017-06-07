import {CWLVersion} from "../../mappings/v1.0/CWLVersion";
import {UnimplementedMethodException} from "../helpers/UnimplementedMethodException";
import {ValidationBase} from "../helpers/validation/ValidationBase";
import {Serializable} from "../interfaces/Serializable";
import {CommandArgumentModel} from "./CommandArgumentModel";
import {CommandInputParameterModel} from "./CommandInputParameterModel";
import {CommandOutputParameterModel} from "./CommandOutputParameterModel";
import {CreateFileRequirementModel} from "./CreateFileRequirementModel";
import {DockerRequirementModel} from "./DockerRequirementModel";
import {ExpressionModel} from "./ExpressionModel";
import {ProcessRequirement} from "./ProcessRequirement";
import {ProcessRequirementModel} from "./ProcessRequirementModel";
import {RequirementBaseModel} from "./RequirementBaseModel";
import {ResourceRequirementModel} from "./ResourceRequirementModel";
import {EventHub} from "../helpers/EventHub";
import {
    fetchByLoc, incrementLastLoc, incrementString, isEmpty, isType,
    validateID
} from "../helpers/utils";
import {CommandLinePrepare} from "../helpers/CommandLinePrepare";
import {CommandLinePart} from "../helpers/CommandLinePart";
import {JobHelper} from "../helpers/JobHelper";

export abstract class CommandLineToolModel extends ValidationBase implements Serializable<any> {
    public id: string;

    public cwlVersion: string | CWLVersion;

    public "class" = "CommandLineTool";

    public sbgId: string;

    public baseCommand: Array<ExpressionModel | string> = [];
    public inputs: CommandInputParameterModel[]         = [];
    public outputs: CommandOutputParameterModel[]       = [];

    public arguments: CommandArgumentModel[] = [];

    public docker: DockerRequirementModel;

    public requirements: Array<ProcessRequirementModel> = [];
    public hints: Array<ProcessRequirementModel>        = [];

    public stdin: ExpressionModel;
    public stdout: ExpressionModel;
    public stderr: ExpressionModel;
    public hasStdErr: boolean;

    public fileRequirement: CreateFileRequirementModel;

    public resources: ResourceRequirementModel;

    public label?: string;
    public description?: string;

    public customProps: any = {};

    public eventHub: EventHub;

    protected jobInputs: any = {};
    protected runtime: any   = {};

    protected constructed: boolean = false;

    protected commandLineWatcher: Function = () => {
    };

    constructor(loc: string) {
        super(loc);

        this.eventHub = new EventHub([
            "input.create",
            "input.remove",
            "input.change",
            "input.change.id",
            "io.change.type",
            "output.create",
            "output.remove",
            "output.change.id",
            "argument.create",
            "argument.remove",
            "field.create",
            "field.remove",
            "validate",
            "binding.shellQuote",
            "expression.serialize"
        ]);
    }

    public on(event: string, handler): { dispose: Function } {
        return {
            dispose: this.eventHub.on(event, handler)
        }
    }

    public off(event: string, handler) {
        this.eventHub.off(event, handler);
    }

    protected getNextAvailableId(id: string, set?: Array<CommandOutputParameterModel | CommandInputParameterModel>) {
        let hasId  = true;
        let result = id;

        set = set || [...this.outputs, ...this.inputs];
        const len = set.length;

        while (hasId) {
            hasId = false;

            // loop through all inputs and outputs to verify id uniqueness
            for (let i = 0; i < len; i++) {
                if (set[i].id === result) {
                    hasId  = true;
                    // if id exists, increment and check the uniqueness of the incremented id
                    result = incrementString(result);
                }
            }
        }

        return result;
    }

    protected checkIdValidity(id: string, scope?: Array<CommandInputParameterModel | CommandOutputParameterModel>) {
        validateID(id);

        const next = this.getNextAvailableId(id, scope);
        if (next !== id) {
            throw new Error(`ID "${id}" already exists in this tool, the next available id is "${next}"`);
        }
    }

    public changeIOId(port: CommandInputParameterModel | CommandOutputParameterModel, id: string) {
        if (port.id === id) {
            return;
        }

        const oldId = port.id;
        let type;
        let scope;
        // emit set proper type so event can be emitted and validity can be scoped
        if (port instanceof CommandInputParameterModel) {
            type = "input";
        } else if (port instanceof CommandOutputParameterModel) {
            type = "output";
        }

        if (port.isField) {
            const loc = port.loc.substr(this.loc.length).replace(/fields\[\d+]$/, "");
            scope = fetchByLoc(this, loc).fields;
        }

        // verify that the new ID can be set
        this.checkIdValidity(id, scope);

        port.id = id;
        if (isType(port, ["record", "enum"])) {
            port.type.name = id;
        }

        // emit change event so CLT subclasses can change job values
        this.eventHub.emit(`${type}.change.id`, {port, oldId, newId: port.id});
    }

    protected initializeJobWatchers() {
        this.eventHub.on("input.change.id", (data) => {
            this.jobInputs[data.newId] = this.jobInputs[data.oldId] || JobHelper.generateMockJobData(data.port);
            delete this.jobInputs[data.oldId];
            this.updateCommandLine();
        });

        this.eventHub.on("io.change.type", (loc: string) => {
            // make sure loc is within this tree and that belongs to one of the inputs
            if (loc.search(this.loc) === 0 && loc.search("inputs") > -1) {
                // remove root part of loc and ignore type part of loc
                loc                                    = loc.substr(this.loc.length).replace("type", "");
                // find port based on its loc
                const port: CommandInputParameterModel = fetchByLoc(this, loc);
                if (!port) {
                    // newly added inputs will trigger this event before they are added to tool
                    return;
                }
                this.jobInputs[port.id] = JobHelper.generateMockJobData(port);
                this.updateCommandLine();
            }
        });

        this.eventHub.on("input.remove", (port: CommandInputParameterModel) => {
            delete this.jobInputs[port.id];
            this.updateCommandLine();
        });

        this.eventHub.on("input.create", (port: CommandInputParameterModel) => {
            this.jobInputs[port.id] = JobHelper.generateMockJobData(port);
            this.updateCommandLine();
        });
    }

    public addHint(hint?: ProcessRequirement | any): RequirementBaseModel {
        new UnimplementedMethodException("addHint", "CommandLineToolModel");
        return null;
    }

    public updateStream(stream: ExpressionModel, type: "stderr" | "stdin" | "stdout") {
        new UnimplementedMethodException("updateStream", "CommandLineToolModel");
    }

    _addOutput(outputConstructor, output?) {
        const loc = incrementLastLoc(this.outputs, `${this.loc}.outputs`);
        const id  = this.getNextAvailableId("output");

        if (output) {
            output.id = output.id || id;
        } else {
            output = {id};
        }

        const o = new outputConstructor(output, loc, this.eventHub);

        o.setValidationCallback(err => this.updateValidity(err));

        try {
            this.checkIdValidity(o.id)
        } catch (ex) {
            this.updateValidity({
                [o.loc + ".id"]: {
                    type: "error",
                    message: ex.message
                }
            });
        }

        this.outputs.push(o);
        return o;
    }

    public addOutput(output?): CommandOutputParameterModel {
        new UnimplementedMethodException("addOutput", "CommandLineToolModel");
        return null;
    }

    public removeOutput(output: CommandOutputParameterModel) {
        const index = this.outputs.indexOf(output);
        if (index < 0) {
            return;
        }
        this.outputs[index].cleanValidity();
        this.outputs.splice(index, 1);
        this.eventHub.emit("output.remove", output);
    }

    protected _addInput(inputConstructor, input?) {
        const loc = incrementLastLoc(this.inputs, `${this.loc}.inputs`);
        const id  = this.getNextAvailableId("input");

        if (input) {
            input.id = input.id || id;
        } else {
            input = {id};
        }

        const i = new inputConstructor(input, loc, this.eventHub);

        i.setValidationCallback(err => this.updateValidity(err));

        try {
            this.checkIdValidity(i.id)
        } catch (ex) {
            this.updateValidity({
                [i.loc + ".id"]: {
                    type: "error",
                    message: ex.message
                }
            });
        }

        this.inputs.push(i);
        this.eventHub.emit("input.create", i);

        return i;
    }

    public addInput(input?): CommandInputParameterModel {
        new UnimplementedMethodException("addInput", "CommandLineToolModel");
        return null;
    }

    public removeInput(input: CommandInputParameterModel) {
        const index = this.inputs.indexOf(input);
        if (index < 0) {
            return;
        }
        this.inputs[index].cleanValidity();
        this.inputs.splice(index, 1);
        this.eventHub.emit("input.remove", input);
    }

    public addArgument(arg?): CommandArgumentModel {
        new UnimplementedMethodException("addArgument", "CommandLineToolModel");
        return null;
    }

    public removeArgument(arg: CommandArgumentModel) {
        const index = this.arguments.indexOf(arg);
        if (index < 0) {
            return;
        }
        this.arguments[index].cleanValidity();
        this.arguments.splice(index, 1);
        this.eventHub.emit("argument.remove", arg);
    }

    public addBaseCommand(cmd?): ExpressionModel | void {
        new UnimplementedMethodException("addBaseCommand", "CommandLineToolModel");
        return null;
    }

    public updateCommandLine(): void {
        if (this.constructed) {
            this.generateCommandLineParts().then(res => {
                this.commandLineWatcher(res);
            })
        }
    }

    public setJobInputs(inputs: any): void {
        new UnimplementedMethodException("setJob", "CommandLineToolModel");
    }

    public setRuntime(runtime: any): void {
        new UnimplementedMethodException("setRuntime", "CommandLineToolModel");
    }

    public getContext(id?: string): any {
        new UnimplementedMethodException("getContext", "CommandLineToolModel");
    };

    public resetJobDefaults(): void {
        new UnimplementedMethodException("resetJobDefaults", "CommandLineToolModel");
    }

    public serialize(): any {
        new UnimplementedMethodException("serialize", "CommandLineToolModel");
    }

    public deserialize(attr: any): void {
        new UnimplementedMethodException("deserialize", "CommandLineToolModel");
    }

    public onCommandLineResult(fn: Function) {
        this.commandLineWatcher = fn;
    }

    public setRequirement(req: ProcessRequirement, hint?: boolean) {
        new UnimplementedMethodException("setRequirement", "CommandLineToolModel");
    }

    public generateCommandLineParts(): Promise<CommandLinePart[]> {
        const flatInputs = CommandLinePrepare.flattenInputsAndArgs([].concat(this.arguments).concat(this.inputs));

        const job = isEmpty(this.jobInputs) ? // if job has not been populated
            {...{inputs: JobHelper.getJobInputs(this)}, ...{runtime: this.runtime}} : // supply dummy values
            this.getContext(); // otherwise use job

        const flatJobInputs = CommandLinePrepare.flattenJob(job.inputs || job, {});

        const baseCmdPromise = this.baseCommand.map((cmd, index) => {
            const loc = `${this.loc}.baseCommand[${index}]`;
            return CommandLinePrepare.prepare(cmd, flatJobInputs, this.getContext(), loc, "baseCommand").then(suc => {
                if (suc instanceof CommandLinePart) return suc;
                return new CommandLinePart(<string>suc, "baseCommand", loc);
            }, err => {
                return new CommandLinePart(`<${err.type} at ${err.loc}>`, err.type, loc);
            });
        });

        const inputPromise = flatInputs.map(input => {
            return CommandLinePrepare.prepare(input, flatJobInputs, this.getContext(input["id"]), input.loc)
        }).filter(i => i instanceof Promise).map(promise => {
            return promise.then(succ => succ, err => {
                return new CommandLinePart(`<${err.type} at ${err.loc}>`, err.type);
            });
        });

        const stdOutPromise = CommandLinePrepare.prepare(this.stdout, flatJobInputs, this.getContext(), this.stdout.loc, "stdout");
        const stdInPromise  = CommandLinePrepare.prepare(this.stdin, flatJobInputs, this.getContext(), this.stdin.loc, "stdin");

        return Promise.all([].concat(baseCmdPromise, inputPromise, stdOutPromise, stdInPromise)).then(parts => {
            return parts.filter(part => part !== null);
        });
    }

    protected checkToolIdUniqueness(): void {
        const map       = {};
        const duplicate = [];
        const ports     = [...this.inputs, ...this.outputs];

        for (let i = 0; i < ports.length; i++) {
            const p = ports[i];

            if (map[p.id]) {
                duplicate.push(p);
            } else {
                map[p.id] = true;
            }
        }

        if (duplicate.length > 0) {
            for (let i = 0; i < duplicate.length; i++) {
                const port = duplicate[i];

                port.updateValidity({
                    [`${port.loc}.id`]: {
                        type: "error",
                        message: `Duplicate id found: “${port.id}”`
                    }
                });
            }
        }
    }
}
