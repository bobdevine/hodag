"use strict";

const NODES = require("./nodes.js");
const METADATA = require("./metadata.js");


exports.init = function(planTree) {
    console.log("---------dbms.init()---------------");
    METADATA.init();
}


exports.exec = function(planTree) {
    console.log("---------BEGIN dbms.exec()---------------");
    planTree.printPlan();
    if (planTree instanceof NODES.Create) {
	console.log("Create-ing", JSON.stringify(planTree));
	METADATA.addTable(planTree.newTable);
    }
    return "exec";
};
