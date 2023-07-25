"use strict";

const SQL_LEXER = require("./lexer_SQL.js");
const NODES = require("./nodes.js");
const PREDICATE = require("./predicate.js");
const METADATA = require("./metadata.js");


//----------------------------------------------------------
// DELETE FROM table_name WHERE ...

exports.parse_column_definition = function(nodeContext, cmd, tokens, indexTokens) {
    for (let t in tokens) { console.log("DELETE", t, tokens[t][0]); }
    //let ret = expression_column_definition(nodeContext, cmd, tokens, indexTokens);
    return { "status": true, "index": ret.index};
}



//----------------------------------------------------


// build optimizable tree from DELETE context block
exports.makeTree = function(contextDelete) {
    //console.log("makeTree() - contextDelete " + JSON.stringify(contextDelete));

    // build top-level node for execution
    let ddlNode = new NODES.DDL_Top();
    
    let deleteNode = new NODES.Delete();

    let rowDelNode = new NODES.TableRowDelete();
    rowDelNode.predicate = contextDelete.wherePredicate;
    
    deleteNode.children.push(rowDelNode);
    
    ddlNode.children.push(deleteNode);

    return ddlNode;    
}
