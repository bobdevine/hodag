"use strict";

const NODES = require("./nodes.js");
const METADATA = require("./metadata.js");

const SELECT = require("./select.js");
const CREATE = require("./create.js");
const DELETE = require("./delete.js");


// this optimizer chooses the best execution plan
// based on local estimates about resource costs and performance
// The optimizer is based on "contracts" between nodes
//
// NOTE: the optimizer could be structued as a multi-path graph
// (or banyon tree or forest or ...) to represent alternative
// solutions, but this code uses simple trees.
//
// NOTE: A metaheuristic is a common but unfortunate name for stochastic
// optimization algorithms used for problems where you don't know how to find a good
// solution, but if shown a candidate solution, you can give it a grade.
//
// Alternatives to avoid/reduce:
//    Full scans
//    Unselective range scans
//    Late predicate filters
//    Wrong join order
//    Late filter operations


//---------------------------------------------------------
// All rules in an array are run for a node before going to next node
// keep iterating optimization of tree until termination condition

exports.optimize = function(trunk) {
    let queryContext = trunk.children[0];
    //console.log("optimizer.optimize()", JSON.stringify(queryContext));
    let queryTree;
    if (queryContext instanceof NODES.ContextBlock_Select) {
	queryTree =  SELECT.makeTree(queryContext);
    } else if (queryContext instanceof NODES.ContextBlock_Alter) {
	queryTree =  ALTER.makeTree(queryContext);
    } else if (queryContext instanceof NODES.ContextBlock_Create) {
	queryTree =  CREATE.makeTree(queryContext);
    } else if (queryContext instanceof NODES.ContextBlock_Delete) {
	queryTree =  DELETE.makeTree(queryContext);
    } else if (queryContext instanceof NODES.ContextBlock_Drop) {
	queryTree =  DROP.makeTree(queryContext);
    } else {
	throw("optimizer.optimize() -- unknown context block");
    }
    //console.log("---------AFTER TREE CREATION---------------");
    //queryTree.printTree();
    
    queryTree.createContracts();
    let optTree = queryTree;

    console.log("---------START Optimize ----");
    // iterate to find alternatives that match contracts
    const max_iterations = 7;
    for (let i=0; i<max_iterations; i++) {
	const alternativeContracts = [];
        optTree.improveContract(null, alternativeContracts);
	if (alternativeContracts.length == 0) {
	    break;
	}

	// evaluate which alternative is best
	//  the best alternative can have many dimensions:
	//  1. I/Os (basically IBM's System R's cost calc)
	//  2. memory size
	//  3. latency
	//  4. CPU use
	//  5. reads vs writes
	//  6. lock costs
	//  7. consistency vs parallelism
	//  8. single vs multi-threading
	//  9. synchronous vs synchromous execution
    }

    //console.log("---------AFTER OPTIMIZE---------------");
    //optTree.printPlan();
    
    return optTree;
};
