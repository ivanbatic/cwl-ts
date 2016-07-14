#!/usr/bin/env bash

ts_json="node_modules/typescript-json-schema/bin/typescript-json-schema --required"
root="src/mappings"

$ts_json ${root}/draft-4/CommandLineTool.ts CommandLineTool > src/parser/schemas/draft-4/CLT-schema.json
$ts_json ${root}/draft-3/CommandLineTool.ts CommandLineTool > src/parser/schemas/draft-3/CLT-schema.json
#$ts_json ${root}/d2sb/CommandLineTool.ts CommandLineTool > src/parser/schemas/d2sb/CLT-schema.json
echo Finished CommandLineTool Schema

$ts_json ${root}/draft-4/Workflow.ts Workflow > src/parser/schemas/draft-4/WF-schema.json
$ts_json ${root}/draft-3/Workflow.ts Workflow > src/parser/schemas/draft-3/WF-schema.json
#$ts_json ${root}/d2sb/Workflow.ts Workflow > src/parser/schemas/d2sb/WF-schema.json
echo Finished Workflow Schema

$ts_json ${root}/draft-4/ExpressionTool.ts ExpressionTool > src/parser/schemas/draft-4/ET-schema.json
$ts_json ${root}/draft-3/ExpressionTool.ts ExpressionTool > src/parser/schemas/draft-3/ET-schema.json
#$ts_json ${root}/d2sb/ExpressionTool.ts ExpressionTool > src/parser/schemas/d2sb/ET-schema.json
echo Finished ExpressionTool Schema
