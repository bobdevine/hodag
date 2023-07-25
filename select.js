"use strict";

// WARNING -- lotsa hacks in here...

const NODES = require("./nodes.js");
const PREDICATE = require("./predicate.js");
const METADATA = require("./metadata.js");
const CLAUSE = require("./clause.js");


// build optimizable tree from SELECT context block
exports.makeTree = function(selectContext) {
    //console.log("makeTree() - selectContext " + JSON.stringify(selectContext));
    
    if (!selectContext.fromTables) {
	throw("formatSelect() -- no tables in FROM");
    }
    const tables = []
    extractTableNames(selectContext.fromTables, tables);

    // build top-level node to display results
    let displayNode = new NODES.Display();

    let treeDataNode = convertInputTables(selectContext, selectContext.fromTables);

    // for each column, build a supply-chain from UI to storage
    for (let i=0; i<selectContext.columnsForDisplay.length; i++) {
	let col = selectContext.columnsForDisplay[i];
	//console.log("formatSelect() - col=")
	//col.printTree();
	//console.log("formatSelect() - col=", JSON.stringify(col));
	let colDisplay = new NODES.DisplayColumn();
	colDisplay.name = col.name;
	colDisplay.functionName = col.functionName;
	colDisplay.params = col.params;
	colDisplay.tableName = col.tableName;
	colDisplay.alias = col.alias;
	colDisplay.parameters = col.parameters;
	//console.log("formatSelect() - colDisplay=");
	//colDisplay.printTree();
	//console.log("formatSelect() - colDisplay=", JSON.stringify(colDisplay));
	displayNode.outputColumns.push(colDisplay);
    }
    for (let i=0; i<selectContext.columnsRequired.length; i++) {
	let col = selectContext.columnsRequired[i];
	//col.printTree("orig col");
	let colRequired = new NODES.InternalColumn();
	colRequired.name = col.name;
	if (col.tableName != null) {
	    if (METADATA.checkNameOneTable(col.tableName, col.name)) {
		colRequired.tableName = col.tableName;
	    } else {
		throw("Unknown column '" + col.name + "'. Not found in table " + col.tableName);
	    }
	} else {
	    colRequired.tableName = METADATA.checkNameAllTables(tables, col.name);
	    if (colRequired.tableName == null) {
		throw("Unknown column '" + col.name + "'. Not found in tables.");
	    }
	}
	displayNode.requiredColumns.push(colRequired);
    }
    
    let bottomNode = displayNode;

    // (optionally, ie if have WHERE clause) add in a FILTER node to supply-chain
    if (selectContext.wherePredicate) {
	//console.log("formatSelect() - got wherePredicate");
	//selectContext.wherePredicate.printTree();

	collectReferencedColumns(selectContext, selectContext.wherePredicate);
	//console.log("++ checkSelect() - after collect", JSON.stringify(selectContext));

	//node.predicate = cloneObject(tables, selectContext.wherePredicate);
	let filterNode = new NODES.Filter();
	filterNode.predicate = PREDICATE.convertPredicateTree(tables, selectContext.wherePredicate);
	//console.log("formatSelect() - after predicate convert");
	for (let i=0; i<bottomNode.requiredColumns.length; i++) {
	    let col = new NODES.InternalColumn();
	    //bottomNode.requiredColumns[i].printTree("FILTER DISPLAY");
	    col.name = bottomNode.requiredColumns[i].name;
	    col.tableName = bottomNode.requiredColumns[i].tableName;
	    //col.printTree("FILTER new col");
	    filterNode.outputColumns.push(col);
	    filterNode.requiredColumns.push(col);
	}
	for (let i=0; i<selectContext.columnsRequired.length; i++) {
	    let name = selectContext.columnsRequired[i].name;
	    //console.log("formatSelect() - inPredicate column", name);
	    // add column to non-display nodes, if not already present
	    let foundMatch = false;
	    for (let k=0; k<bottomNode.requiredColumns.length; k++) {
		if (name == bottomNode.requiredColumns[k].name) {
		    foundMatch = true;
		    break;
		}
	    }
	    if (foundMatch != true) {
		let col = new NODES.InternalColumn();
		col.name = name;
		col.tableName = METADATA.checkNameAllTables(tables, name);
		if (col.tableName == null) {
		    throw("Unknown column '" + name + "'. Not found in listed tables.");
		}
		filterNode.requiredColumns.push(col);
	    }
	}
	//console.log("formatSelect() - after columns");
	//filterNode.printTree(' ");
	bottomNode.children.push(filterNode);
	//bottomNode.printTree(" ");
	bottomNode = filterNode;
    }

    // (required) convert data source(s)
    if (!selectContext.fromTables) {
	// this error should be caught earlier
	throw("Missing table(s) in FROM clause");
    }

    // check if REQ columns = OUT columns
    const colReq = bottomNode.requiredColumns.length;
    const colsChildOut = treeDataNode.outputColumns.length;
    if (colReq < colsChildOut) {
	//console.log("bottomNode - REQ =", colReq);
	//console.log("treeDataNode - child OUT", colsChildOut);
	let projectNode = new NODES.Project();
	projectNode.children.push(treeDataNode);
	for (let i=0; i<bottomNode.requiredColumns.length; i++) {
	    let col = new NODES.InternalColumn();
	    col.name = bottomNode.requiredColumns[i].name;
	    col.tableName = bottomNode.requiredColumns[i].tableName;
	    // a project accepts more columns than it requires
	    // optimizer stage will negotiate require vs accept
	    projectNode.outputColumns.push(col);
	    projectNode.requiredColumns.push(col);
	}
	bottomNode.children.push(projectNode);
    } else {
	bottomNode.children.push(treeDataNode);
    }

    // return the tree of nodes
    return displayNode;
}


//-----------


function collectReferencedColumns(selectContext, obj) {
    //console.log("++ collectReferencedColumns()");
    if (!obj) return;
    if (typeof obj !== 'object') return;

    if (obj instanceof NODES.Operand) {
        collectPredicate_Operand(selectContext, obj);
    } else if (obj instanceof NODES.OperandArray) {
        collectPredicate_OperandArray(selectContext, obj);
    } else if (obj instanceof NODES.Operator_Comparison) {
        collectPredicate_OperatorComparison(selectContext, obj);
    } else if (obj instanceof NODES.Operator_Logical) {
        collectPredicate_OperatorLogical(selectContext, obj);
    } else if (obj instanceof NODES.Operator_Between) {
        collectPredicate_OperatorBetween(selectContext, obj);
    } else if (obj instanceof NODES.Operator_In) {
        collectPredicate_OperatorIn(selectContext, obj);
    } else {
        console.error("collectReferencedColumns() unknown obj", obj.constructor());
	obj.printTree();
        return;
    }
}


function collectPredicate_OperandArray(selectContext, obj) {
    //console.log("++ comparison operator =", obj.operator);
    for (let i=0; i<obj.values; i++) {
	collectReferencedColumns(selectContext, obj.values[i]);
    }
}

function collectPredicate_OperatorComparison(selectContext, obj) {
    //console.log("++ comparison operator =", obj.operator);
    collectReferencedColumns(selectContext, obj.left);
    collectReferencedColumns(selectContext, obj.right);
}

function collectPredicate_OperatorLogical(selectContext,  obj) {
    //console.log("++ logical operator");
    collectReferencedColumns(selectContext, obj.left);
    collectReferencedColumns(selectContext, obj.right);
}

function collectPredicate_OperatorBetween(selectContext, obj) {
    //console.log("++ between operator");
    collectReferencedColumns(selectContext, obj.left);
    collectReferencedColumns(selectContext, obj.right);
}

function collectPredicate_OperatorIn(selectContext, obj) {
    //console.log("++ between operator");
    collectReferencedColumns(selectContext, obj.left);
    collectReferencedColumns(selectContext, obj.right);
}


function collectPredicate_Operand(selectContext, obj) {
    //console.log("++ comparison operand", JSON.stringify(obj));
    let realTableName;
    if (obj.type == "SQL_COLUMN_VARIABLE") {
	//console.log("collectPredicate_Operand() VARIABLE");
	//console.log("++", JSON.stringify(obj));
	if (obj.tableName == null) {
	    let tables = [];
	    getAllTablenames(tables, selectContext.fromTables);
	    //console.log("++ comparison operand, tables =", tables);
	    let tableMatch = METADATA.checkNameAllTables(tables, obj.name);
	    if (tableMatch == null) {
		// TO DO -- better error message?
		throw("Unknown column name '" + obj.name + "' in from-list table(s)");
	    }
	    realTableName = tableMatch;
	} else {
	    // obj.tableName could be an alias or a table name
	    realTableName = CLAUSE.findTableNameFromAlias(selectContext.fromTables, obj.tableName);
	    //console.log("collectPredicate_Operand() real table name " + realTableName + " for WHERE table name/alias " + obj.tableName + " column " + obj.name);
	    // if still unknown, try looking for alias as a referenced table name
	    if (realTableName == null) {
		if (findTableName(selectContext.fromTables, obj.tableName)) {
		    realTableName = obj.tableName;
		} else {
		    throw("Unknown table name/alias " + obj.tableName);
		}
	    }
	}
	
	// add column to columnsRequired list, if not present
	CLAUSE.addToRequiredList(selectContext, obj.name, realTableName);
    }
}

function getAllTablenames(list, entry) {
    if (entry instanceof NODES.RawTable) {
	// TODO avoid/worry about duplicate names?
	list.push(entry.name);
    } else if (entry instanceof NODES.RawJoin) {
	getAllTablenames(list, entry.left);
	getAllTablenames(list, entry.right);
    } else {
	console.log("getAllTablenames() unknown node", JSON.stringify(entry));
	throw("getAllTablenames() -- node not 'RawTable' or 'RawJoin'");
    }
}


function convertInputTables(selectContext, entry) {
    //console.log("isColumnIn() node", JSON.stringify(entry));
    if (entry instanceof NODES.RawTable) {
	let tablename = entry.name;
	let tableNode = new NODES.TableScan();
	tableNode.tableName = entry.name;
	let metadataCols = METADATA.getColumns(entry.name);
	//console.log("convertInputTables() - table", tablename, "cols", metadataCols);
	for (let i=0; i<metadataCols.length; i++) {
	    let col = new NODES.InternalColumn();
	    col.name = metadataCols[i];
	    col.tableName = entry.name;
	    tableNode.outputColumns.push(col);
	}
	//tableNode.printTree("CIT");
	/***
	// group columns by table name
	for (let i=0; i<selectContext.columnsRequired.length; i++) {
	    let col = selectContext.columnsRequired[i];
	    if (col.table == tablename) {
		tableNode.outputColumns.push(col);
	    }
	}
	***/
	return tableNode;
    } else if (entry instanceof NODES.RawJoin) {
	//console.log("convertInputTables() - join");
	let joinNode = new NODES.Join();
	joinNode.joinType = entry.joinType;

	let nodeLeft = convertInputTables(selectContext, entry.left);
	let nodeRight = convertInputTables(selectContext, entry.right);

	joinNode.left = nodeLeft;
	joinNode.right = nodeRight;
	//joinNode.printTree("CIT ");

	// figure out join columns (warning: SQL is very complicated and weird)
	// T1 NATURAL { [INNER] | { LEFT | RIGHT | FULL } [OUTER] } JOIN T2
	// T1 { [INNER] | { LEFT | RIGHT | FULL } [OUTER] } JOIN T2 ON expression
	// T1 { [INNER] | { LEFT | RIGHT | FULL } [OUTER] } JOIN T2 USING ( col list )
	//                           Inner  Left  Right  Full   Cross   Natural
	// All records of table 1?   No     Yes   No     Yes    Yes     No
	// All records of table 2?   No     No    Yes    Yes    Yes     No
	// Different column names?   Yes    Yes   Yes    Yes    N/A     No
	//console.log("convertInputTables() - join type# =", joinNode.joinType )
	
	if (joinNode.joinType & NODES.JOIN_TYPE_NATURAL) {
	    // NATURAL is a shorthand form of USING, where columns with the same name
	    // of input tables will appear only once in result.
	    //console.log("formatSelect() - JOIN NATURAL");
	    // NOTE: Some DBMSs returns the original table for NATURAL self-joins,
	    //       but Oracle gives an ORA-00918 error
	    // unpredictable results: SELECT COUNT(*) FROM t1 NATURAL JOIN t1
	    if (entry.usingClause) {
		throw("NATURAL JOIN cannot have a USING clause");
	    }
	    if (entry.onClause) {
		throw("NATURAL JOIN cannot have an ON clause");
	    }
	} else if (entry.onClause) {
	    // try to discover join columns from predicate (explicit ON clause)
	    if (selectContext.fromTables.usingClause) {
		throw("JOIN cannot have both ON and USING clauses");
	    }
	    // TODO - these checks might not be needed, new parser prevents
	    if (joinNode.joinType & NODES.JOIN_TYPE_CROSS) {
		throw("CROSS JOIN cannot have an ON clause");
	    }
	    CLAUSE.setJoinColumns_OnClause(joinNode, entry.onClause);
	} else if (entry.usingClause) {
	    // try to discover join columns from predicate (explicit USING clause)
	    // 1. both tables have a column with the same name on which they join
	    // SELECT ... FROM tab1 JOIN tab2 USING (col) WHERE ...
	    // 2. comma-separated list of the shared column names
	    // SELECT ... FROM tab1 JOIN tab2 USING (col1, col2) WHERE ...
	    if (joinNode.joinType & NODES.JOIN_TYPE_CROSS) {
		throw("CROSS JOIN cannot have USING clause");
	    }
	    //console.log("USING CLAUSE " + JSON.stringify(selectContext.fromTables));
	    CLAUSE.setJoinColumns_UsingClause(joinNode, entry.usingClause);
	} else if (selectContext.wherePredicate) {
	    // TODO: extract only join-specific parts from WHERE clause
	    // now, just punt by assuming that all parts are for the join
	    //setJoinColumns_WhereClause(joinNode);
	    joinNode.predicate = selectContext.wherePredicate;
	    selectContext.wherePredicate = null;
	} else {
	    throw("convertInputTables() -- join columns were not specified");
	}

	setJoinColumns_Internal(joinNode);
	
	return joinNode;
    }
    let nodeLeft = null;
    if (selectContext.fromTables instanceof NODES.RawTable) {
	let tablename = selectContext.fromTables.name;
	//console.log("formatSelect() table", t, tablename);
	let tablereadNode = new NODES.RawTable();
	tablereadNode.tableName = tablename;
	let metadataCols = METADATA.getColumns(tableName);
	// group columns by table name
	for (let i=0; i<metadataCols.length; i++) {
	    tablereadNode.outputColumns.push(metadataCols[i]);
	}
	// build a left-deep join tree (optimizer can change later)
	if (nodeLeft == null) {
	    nodeLeft = tablereadNode;
	} else {
	    // push current nodeLeft as a child of new Join
	    let joinNode = new NODES.Join();
	    // set as a CROSS JOIN that optimizer can change later
	    joinNode.joinType = "CROSS";
	    joinNode.left = nodeLeft;
	    joinNode.right = tablereadNode;
	    setJoinColumns_Cross(joinNode);
	    nodeLeft = joinNode;
	}

	return nodeLeft;
    } else {
	//console.log("isColumnIn() unknown node", JSON.stringify(entry));
	throw("isColumnIn() -- node not type 'RawTable' or 'RawJoin'");
    }
}


function setJoinColumns_Internal(entry) {
    // set internal columns in bottom-up order
    if (!entry) {
	console.log("setJoinColumns() - bad entry", JSON.stringify(entry));
	return;
    }

    if (entry instanceof NODES.TableScan) {
	//console.log("setJoinColumns() table " + entry.tableName);
	// hit bottom node
	return;
    } else if (entry instanceof NODES.Join) {
	//console.log("setJoinColumns() checking join children");
        setJoinColumns_Internal(entry.left);
        setJoinColumns_Internal(entry.right);

	setJoinColumns_Required(entry);
	setJoinColumns_Output(entry);
    } else {
	console.log("setJoinColumns_Internal() unknown node", JSON.stringify(entry));
	throw("setJoinColumns_Internal() -- node not type 'TableScan' or 'Join'");
    }
}


function setJoinColumns_Output(entry) {
    /****
    let str = "";
    if (entry.joinType & NODES.JOIN_TYPE_NATURAL) {
	str += "NATURAL ";
    }
    if (entry.joinType & NODES.JOIN_TYPE_INNER) {
	str += "INNER";
    } else if (entry.joinType & NODES.JOIN_TYPE_OUTER_LEFT) {
	str += "LEFT OUTER";
    } else if (entry.joinType & NODES.JOIN_TYPE_OUTER_RIGHT) {
	str += "RIGHT OUTER";
    } else if (entry.joinType & NODES.JOIN_TYPE_OUTER_FULL) {
	str += "FULL OUTER";
    } else if (entry.joinType & NODES.JOIN_TYPE_UNION) {
	str += "UNION";
    } else if (entry.joinType & NODES.JOIN_TYPE_CROSS) {
	str = "CROSS";
    } else {
	throw("setJoinColumns_Output() Unknown join type " + entry.joinType);
    }
    str += " JOIN";
    console.log("setJoinColumns() join type", entry.joinType, str);
    ***/
    if (entry.joinType & NODES.JOIN_TYPE_NATURAL) {
	setJoinOutputColumns_Natural(entry);
    } else {
	setJoinOutputColumns_All(entry);
    }
}


function setJoinColumns_Required(joinNode) {
    const colsLeft = [];
    for (let c=0; c<joinNode.left.outputColumns.length; c++) {
	colsLeft.push(joinNode.left.outputColumns[c].name);
	let col = new NODES.InternalColumn();
	col.name = joinNode.left.outputColumns[c].name;
	col.tableName = joinNode.left.outputColumns[c].tableName;
	joinNode.requiredColumnsLeft.push(col);
    }
    //console.log("setJoinColumns_Required() left output cols", colsLeft);

    const colsRight = [];
    for (let c=0; c<joinNode.right.outputColumns.length; c++) {
	colsRight.push(joinNode.right.outputColumns[c].name);
	let col = new NODES.InternalColumn();
	col.name = joinNode.right.outputColumns[c].name;
	col.tableName = joinNode.right.outputColumns[c].tableName;
	joinNode.requiredColumnsRight.push(col);
    }
    //console.log("setJoinColumns_Required() right output cols", colsRight);
}


function setJoinOutputColumns_Natural(joinNode) {
    console.log("setJoinColumns_Natural()");
    let colsLeft;
    let joinCols = [];
    // 1. add all columns from left
    for (let c=0; c<joinNode.requiredColumnsLeft.length; c++) {
	let col = joinNode.requiredColumnsLeft[c];
	let colOut = new NODES.InternalColumn();
	colOut.name = col.name;
	colOut.tableName = col.tableName;
	joinNode.outputColumns.push(colOut);
    }
    
    // 2. add SOME columns from right
    for (let c=0; c<joinNode.requiredColumnsRight.length; c++) {
	let colRight = joinNode.requiredColumnsRight[c];
	let matchedCol = -1;
	for (let i=0; i<joinNode.requiredColumnsLeft.length; i++) {
	    let colLeft = joinNode.requiredColumnsLeft[i];
	    if (colLeft.name == colRight.name) {
		// NATURAL JOIN column
		// TODO: join columns must have comparable data types
		// TODO: case-sensitive names?
		matchedCol = i;
		let colNatural = {
		    "name" : colLeft.name,
		    "tableNameLeft" : colLeft.tableName,
		    "tableNameRight" : colRight.tableName
		};
		joinCols.push(colNatural);
		break;
	    }
	}
	if (matchedCol < 0) {
	    let colOut = new NODES.InternalColumn();
	    colOut.name = colRight.name;
	    colOut.tableName = colRight.tableName;
	    joinNode.outputColumns.push(colOut);
	}
    }

    console.log("setJoinColumns_Natural() -- joinCols " + JSON.stringify(joinCols));
    if (joinCols.length < 1) {
	throw("NATURAL JOIN has no matching join columns");
    }
    // build join predicate
    let pred = null;
    for (let i=0; i<joinCols.length; i++) {
	if (pred == null) {
	    pred = new NODES.Operator_Comparison();
	    pred.operator = "LEX_EQUAL";
	    let colLeft = new NODES.InternalColumn();
	    colLeft.name =  joinCols[i].name;
	    colLeft.tableName = joinCols[i].tableNameLeft;
	    let colRight = new NODES.InternalColumn();
	    colRight.name =  joinCols[i].name;
	    colRight.tableName = joinCols[i].tableNameRight;
	    pred.left = colLeft;
	    pred.right = colRight;
	} else {
	    let root = new NODES.Operator_Logical();
	    root.operator = "LEX_KEYWORD_AND";
	    root.left = pred;
	    
	    root.right = new NODES.Operator_Comparison();
	    root.right.operator = "LEX_EQUAL";	    
	    let colLeft = new NODES.InternalColumn();
	    colLeft.name =  joinCols[i].name;
	    colLeft.tableName = joinCols[i].tableNameLeft;
	    let colRight = new NODES.InternalColumn();
	    colRight.name =  joinCols[i].name;
	    colRight.tableName = joinCols[i].tableNameRight;

	    root.right.left = colLeft;
	    root.right.right = colRight;
	    pred = root;
	}
    }
    joinNode.predicate = pred;
}


function setJoinOutputColumns_All(joinNode) {
    //console.log("setJoinColumns_Outer()");
    let colsLeft;
    let joinCols = [];
    // 1. add all columns from left
    for (let c=0; c<joinNode.requiredColumnsLeft.length; c++) {
	let col = joinNode.requiredColumnsLeft[c];
	let colOut = new NODES.InternalColumn();
	colOut.name = col.name;
	colOut.tableName = col.tableName;
	joinNode.outputColumns.push(colOut);
    }
    
    // 2. add all columns from right
    for (let c=0; c<joinNode.requiredColumnsRight.length; c++) {
	let colRight = joinNode.requiredColumnsRight[c];
	let colOut = new NODES.InternalColumn();
	colOut.name = colRight.name;
	colOut.tableName = colRight.tableName;
	joinNode.outputColumns.push(colOut);
    }
}


function checkFromEntry(selectContext, entry) {
    if (entry instanceof NODES.RawTable) {
	let tablename = entry.name;
	//console.log("checkFromEntry() checking table " + tablename);
	if (!METADATA.validTablename(tablename)) {
	    //console.log("checkFromEntry() INVALID tablename=" + tablename);
	    throw("checkSelect() -- unknown table: " + tablename);
	}
	addToTableList(selectContext, tablename);
    } else if (entry instanceof NODES.RawJoin) {
	//console.log("checkFromEntry() checking tablejoin");
	checkFromEntry(selectContext, entry.left);
	checkFromEntry(selectContext, entry.right);
    } else {
	//console.log("checkFromEntry() unknown node", JSON.stringify(entry));
	throw("checkFromEntry() -- node not type 'RawTable' or 'RawJoin'");
    }
}


function extractTableNames(entry, list) {
    if (entry instanceof NODES.RawTable) {
	let tablename = entry.name;
	list.push(tablename);
    } else if (entry instanceof NODES.RawJoin) {
	//console.log("checkFromEntry() checking tablejoin");
	extractTableNames(entry.left, list);
	extractTableNames(entry.right, list);
    } else {
	//console.log("extractTableNames() unknown node", JSON.stringify(entry));
	throw("extractTableNames() -- node not type 'Table' or 'RawJoin'");
    }
}


function setJoinColumns_Cross(joinNode) {
    console.log("setJoinColumns_Cross()");
    //joinNode.printTree(" ");
    let colsJoin = [];
    let colsLeft = METADATA.getColumns(joinNode.left.tableName);
    let colsRight = METADATA.getColumns(joinNode.right.tableName);

    for (let l=0; l<colsLeft.length; l++) {
	colsJoin.push(colsLeft[l]);
    }
    for (let r=0; r<colsRight.length; r++) {
	colsJoin.push(colsLeft[l]);
    }
    
    // build join predicate
    let pred  = new NODES.Operator_Boolean();
    pred.value = true;
    joinNode.predicate = pred;
}

