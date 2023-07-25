"use strict";

const NODES = require("./nodes.js");
const METADATA = require("./metadata.js");

exports.setJoinColumns_UsingClause = function(joinNode, usingList) {
    //console.log("setJoinColumns_UsingClause()");
    //console.log("setJoinColumns_UsingClause() -- clause " + JSON.stringify(usingList));
    //let joinCols = [];

    let pred = null;
    let colCount = 0;

    let tableLeft = joinNode.left.tableName;
    let tableRight = joinNode.right.tableName;
    let colsLeft = METADATA.getColumns(tableLeft);
    let colsRight = METADATA.getColumns(tableRight);

    // ensure that USING columns appear in both tables
    for (let i=0; i<usingList.length; i++) {
	let foundMatch = false;
	for (let l=0; l<colsLeft.length; l++) {
	    //console.log("setJoinColumns_UsingClause() -- colsLeft", l, colsLeft[l]);
	    if (colsLeft[l] == usingList[i]) {
		foundMatch = true;
		break;
	    }
	}
	if (foundMatch == false) {
	    throw("JOIN USING - column '" + usingList[i] + "' is not in table " + tableLeft);
	}
	foundMatch = false;
	for (let r=0; r<colsRight.length; r++) {
	    //console.log("setJoinColumns_UsingClause() -- colsRight", r, colsRight[r]);
	    // case-sensitive names?
	    if (colsRight[r] == usingList[i]) {
		foundMatch = true;
		break;
	    }
	}
	if (foundMatch == false) {
	    throw("JOIN USING - column '" + usingList[i] + "' is not in table " + tableRight);
	}
	colCount += 1;
	if (pred == null) {
	    const colLeft = new NODES.InternalColumn();
	    colLeft.tableName = tableLeft;
	    colLeft.name = usingList[0];
	    
	    const colRight = new NODES.InternalColumn();
	    colRight.tableName = tableRight;
	    colRight.name = usingList[0];
	    
	    pred = new NODES.Operator_Comparison();
	    pred.operator = "LEX_EQUAL";
	    pred.left = colLeft;
	    pred.right = colRight;
	    pred.printTree("Using");
	} else {
	    // TODO - use all columns given in USING clause?
	    throw("UNIMPLEMENTED - multiple columns in USING clause");
	}
    }

    if (colCount == 0) {
	throw("JOIN with USING clause has no matching join columns");
    }

    joinNode.predicate = pred;
}


exports.findTableNameFromAlias = function(entry, tableAlias) {
    if (entry instanceof NODES.RawTable) {
	//console.log("findTableNameFromAlias() table.name", entry.name, "alias =", entry.alias);
	if (tableAlias == entry.alias) {
	    //console.log("findTableNameFromAlias() FOUND table.name", entry.name, "alias =", entry.alias);
	    return entry.name;
	} else 	if (tableAlias == entry.name) {
	    // dotted-name used actual tablename, so just return it
	    return entry.name;
	}
	return null;
    } else if (entry instanceof NODES.RawJoin) {
	let val = exports.findTableNameFromAlias(entry.left, tableAlias);
	if (val != null) return val;
	return exports.findTableNameFromAlias( entry.right, tableAlias);
    } else {
	console.log("findTableNameFromAlias() unknown node", JSON.stringify(entry));
	throw("findTableNameFromAlias() -- node not 'RawTable' or 'RawJoin'");
    }
}


exports.setJoinColumns_WhereClause = function(joinNode) {
    // original SQL implicit join syntax
    console.log("setJoinColumns_WhereClause()");
}


function checkOnClause(joinNode, pred) {
    // allow for:
    // 1) equijoins: col1 = col2
    // 2) general math expressions: col1 + col2 = 123
    // 3) other (legal SQL?) col1 < col2
    if (!pred) {
	throw("JOIN with ON clause has no matching join columns");
    }
}

function convertOnClause(joinNode, obj) {
    if (obj instanceof NODES.Operand) {
        return convertOnClause_Operand(joinNode, obj);
    } else if (obj instanceof NODES.Operator_Comparison) {
        return convertOnClause_OperatorComparison(joinNode, obj);
    } else if (obj instanceof NODES.Operator_Math) {
        return convertOnClause_OperatorMath(joinNode, obj);
    } else if (typeof obj !== 'object') {
        console.error("convertOnClause() parameter not an object");
	return null;
    } else {
        console.error("convertOnClause() unknown object", obj.constructor());
	obj.printTree("? ");
	return null;
    }
}

function convertOnClause_Operand(joinNode, obj) {
    //console.log("convertOnClause_Operand()");
    //console.log("convertOnClause_Operand() obj", JSON.stringify(obj));
    if (obj.type != "SQL_COLUMN_VARIABLE") {
	throw("convertOnClause_Operand() JOIN ON column not SQL_COLUMN_VARIABLE");
    }

    // easy case - already have unique name
    if (obj.tableName) {
	let col = new NODES.InternalColumn();
	col.tableName = obj.tableName;
	col.name = obj.name;
	//col.printTree("=L=");
	return col;
    }

    // hard case - try to match column name to join's table's metadata
    //joinNode.printTree("OP");
    let tableNameLeft;
    tableNameLeft = joinNode.left.tableName;
    let colsLeft = METADATA.getColumns(tableNameLeft);
    //console.log("convertOnClause_Operand()", "tableNameLeft", tableNameLeft);
    //console.log("convertOnClause_Operand()", "colsLeft", colsLeft);
    
    const tableNameRight = joinNode.right.tableName;
    let colsRight = METADATA.getColumns(tableNameRight);
    //console.log("convertOnClause_Operand()", "colsRight", colsRight);
    
    for (let i=0; i<colsLeft.length; i++) {
	//console.log("convertOnClause_Operand() -- colsLeft", l, colsLeft[l]);
	// case-sensitive names?
	if (colsLeft[i] == obj.name) {
	    // matched left table
	    //console.log("convertOnClause_Operand() -- matched", obj.name, tableNameLeft);
	    // check for name abiguity
	    for (let i=0; i<colsRight.length; i++) {
		if (colsLeft[i] == obj.name) {
		    // mathed BOTH tables
		    throw("JOIN ON column '" + obj.name + "' matched both table " + tableNameLeft + " and table " + tableNameRight);
		}
	    }
	    let col = new NODES.InternalColumn();
	    col.tableName = tableNameLeft;
	    col.name = obj.name;
	    col.printTree("=L=");
	    return col;
	}
    }
    
    // try comparing to right table
    for (let i=0; i<colsRight.length; i++) {
	//console.log("convertOnClause_Operand() -- colsRight", r, colsRight[r]);
	// case-sensitive names?
	if (colsRight[i] == obj.name) {
	    let col = new NODES.InternalColumn();
	    col.tableName = tableNameRight;
	    col.name = obj.name;
	    col.printTree("=R=");
	    return col;
	}
    }

    throw("JOIN ON column '" + obj.name + "' not in table " + tableNameLeft + " or table " + tableNameRight);

    return obj;
}


function convertOnClause_OperatorComparison(joinNode, obj) {
    obj.left = convertOnClause(joinNode, obj.left);
    obj.right = convertOnClause(joinNode, obj.right);
    return obj;
}

function convertOnClause_OperatorMath(joinNode, obj) {
    console.log("convertOnClause_OperantorMath()");
    obj.left = convertOnClause(joinNode, obj.left);
    obj.right = convertOnClause(joinNode, obj.right);
    return obj;
}


exports.setJoinColumns_OnClause = function (joinNode, onClause) {
    //console.log("setJoinColumns_OnClause()");
    //joinNode.printTree(" ");
    if (!onClause) {
	throw("Missing ON clause");
    }
    //onClause.printTree("-- ");
    if (onClause instanceof NODES.Operator_Comparison) {
	if (onClause.operator != "LEX_EQUAL") {
	    throw("Expected comparison operator in ON clause, got " + onClause.operator);
	}
    } else {
	throw("Expected comparison for ON clause");
    }

    let pred = convertOnClause(joinNode, onClause);
    //console.log("setJoinColumns_OnClause() -- predicate", JSON.stringify(pred));
    checkOnClause(joinNode, pred);
    joinNode.predicate = pred;
}

/**************************
    for (let i=0; i<onColsLeft.length; i++) {
	let foundMatch = false;
	for (let l=0; l<colsLeft.length; l++) {
	    //console.log("setJoinColumns_OnClause() -- colsLeft", l, colsLeft[l]);
	    // case-sensitive names?
	    if (colsLeft[l] == onColsLeft[i]) {
		foundMatch = true;
		break;
	    }
	}
	if (foundMatch == true) {
	    // matched left table
	    //console.log("setJoinColumns_OnClause() -- matched", onColsLeft[i], tableLeft);
	    let fullname = tableLeft + '.' + onColsLeft[i];
	    joinCols.push(fullname);
	    continue;
	} else {
	    // try comparing to right table
	    let foundMatch = false;
	    for (let r=0; r<colsRight.length; r++) {
		//console.log("setJoinColumns_OnClause() -- colsRight", r, colsRight[r]);
		// case-sensitive names?
		if (colsRight[r] == onColsLeft[i]) {
		    foundMatch = true;
		    break;
		}
	    }
	    if (foundMatch == false) {
		throw("JOIN USING column '" + onColsLeft[i] + "' not in table " + tableLeft + " or table " + tableRight);
	    } else {
		// matched right table
		//console.log("setJoinColumns_OnClause() -- matched", onColsLeft[i], tableRight);
		let fullname = tableRight + '.' + onColsLeft[i];
		joinCols.push(fullname);
	    }
	}
    }

    for (let i=0; i<onColsRight.length; i++) {
	let foundMatch = false;
	for (let l=0; l<colsRight.length; l++) {
	    //console.log("setJoinColumns_OnClause() -- colsRight", l, colsRight[l]);
	    // case-sensitive names?
	    if (colsRight[l] == onColsRight[i]) {
		foundMatch = true;
		break;
	    }
	}
	if (foundMatch == true) {
	    // matched left table
	    //console.log("setJoinColumns_OnClause() -- matched", onColsRight[i], tableRight);
	    let fullname = tableRight + '.' + onColsRight[i];
	    joinCols.push(fullname);
	    continue;
	} else {
	    // try comparing to right table
	    let foundMatch = false;
	    for (let r=0; r<colsRight.length; r++) {
		//console.log("setJoinColumns_OnClause() -- colsRight", r, colsRight[r]);
		// case-sensitive names?
		if (colsRight[r] == onColsRight[i]) {
		    foundMatch = true;
		    break;
		}
	    }
	    if (foundMatch == false) {
		throw("JOIN USING column '" + onColsRight[i] + "' not in table " + tableRight + " or table " + tableRight);
	    } else {
		// matched right table
		//console.log("setJoinColumns_OnClause() -- matched", onColsRight[i], tableRight);
		let fullname = tableRight + '.' + onColsRight[i];
		joinCols.push(fullname);
	    }
	}
    }
******************/


exports.checkForValidTablesInFromClause = function (selectContext, entry) {
    if (entry instanceof NODES.RawTable) {
	let tablename = entry.name;
	//console.log("checkForValidTablesInFromClause() checking table " + tablename);
	if (!METADATA.validTablename(tablename)) {
	    //console.log("checkForValidTablesInFromClause() INVALID tablename=" + tablename);
	    throw("checkSelect() -- unknown table: " + tablename);
	}
	//addToTableList(selectContext, tablename);
    } else if (entry instanceof NODES.RawJoin) {
	//console.log("checkForValidTablesInFromClause() checking tablejoin");
	exports.checkForValidTablesInFromClause(selectContext, entry.left);
	exports.checkForValidTablesInFromClause(selectContext, entry.right);
    } else {
	console.log("checkForValidTablesInFromClause() unknown node", JSON.stringify(entry));
	throw("checkForValidTablesInFromClause() -- node not 'RawTable' or 'RawJoin'");
    }
}


exports.addToRequiredList = function (selectContext, colname, table) {
    // no duplicate names allowed (for performance)
    //console.log("addToRequiredList()", "colname =", colname, "table =", table);
    let foundMatch = false;
    for (let c=0; c<selectContext.columnsRequired.length; c++) {
	if (colname == selectContext.columnsRequired[c].name) {
	    foundMatch = true;
	    break;
	}
    }
    if (foundMatch != true) {
	let col = new NODES.InternalColumn();
	col.name = colname;
	col.tableName = table;
	selectContext.columnsRequired.push(col);
    }
}
