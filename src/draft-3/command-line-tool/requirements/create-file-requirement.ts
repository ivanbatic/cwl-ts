import {FileDef} from "../file-def";
import {Requirement} from "./requirement";
export interface CreateFileRequirement extends Requirement {
    fileDef: FileDef[];
}