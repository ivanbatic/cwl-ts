import {ValidationBase} from "../helpers/validation/ValidationBase";
import {Serializable} from "../interfaces/Serializable";
import {InputParameter} from "./InputParameter";
import {Plottable} from "./Plottable";
import {STEP_OUTPUT_CONNECTION_PREFIX} from "../helpers/constants";
import {UnimplementedMethodException} from "../helpers/UnimplementedMethodException";
import {EventHub} from "../helpers/EventHub";
import {ParameterTypeModel} from "./ParameterTypeModel";

export class WorkflowInputParameterModel extends ValidationBase implements InputParameter, Serializable<any>, Plottable {
    public id: string;
    public type: ParameterTypeModel;
    public fileTypes: string[] = [];

    public inputBinding?: any;

    protected _label?: string;

    get label(): string {
        return this._label;
    }

    set label(value: string) {
        this._label = value;
        this.eventHub.emit("io.change", this);
    }

    public description?: string;

    public isField: boolean;

    public isVisible = true;

    protected eventHub: EventHub;

    constructor(loc?, eventHub?) {
        super(loc);
        this.eventHub = eventHub;
    }

    /**
     * ID to be used when adding as source
     */
    get sourceId(): string {
        return this.id;
    }

    /**
     * ID to be used in graph
     */
    get connectionId(): string {
        return `${STEP_OUTPUT_CONNECTION_PREFIX}${this.id}/${this.id}`;
    }

    customProps: any = {};

    updateLoc(loc: string) {
        // must update location of self first
        super.updateLoc(loc);

        // update location of type, so that in case the input is a field,
        // newly created fields will have correct loc
        this.type.updateLoc(`${loc}.type`);
    }

    serialize(): any {
        new UnimplementedMethodException("serialize", "WorkflowInputParameterModel");
    }

    deserialize(attr: any): void {
        new UnimplementedMethodException("deserialize", "WorkflowInputParameterModel");
    }

    validate(): Promise<any> {
        this.cleanValidity();
        const promises = [];

        promises.push(this.type.validate());

        return Promise.all(promises).then(res => this.issues);
    }
}