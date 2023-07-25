"use strict";

const NODES = require("./nodes.js");
const METADATA = require("./metadata.js");
const CLAUSE = require("./clause.js");


// check and convert a parse tree to a query tree
exports.CheckQueryContext = function(context) {
    //console.log("VALIDATOR.CheckQueryContext()");
    
    if (context.children.length < 1) {
	throw("CheckQueryTree() - missing parsed context");
    }

    //console.log("VALIDATOR.CheckQueryContext() context", JSON.stringify(context));
    if (context.children[0] instanceof NODES.ContextBlock_Select) {
	checkSelect(context);
	//console.log("validator.CheckQueryTree() COLUMN_REFERENCES :", COLUMN_REFERENCES);
	//queryTree.printTree();
    }

    return context;
}


// check validity of context block and bind variables
function checkSelect(context) {
    // check that a valid context was passed in
    if (context instanceof NODES.Trunk) {
	//console.log("checkSelect() - got TRUNK");
    } else {
	throw("CheckQueryTree() - unknown parsed SELECT context");
    }

    // *** check requirements of parsed context for SELECT
    let selectContext = context.children[0];

     // ensure lists are empty
    selectContext.columnsForDisplay = [];
    selectContext.columnsRequired = [];

    // *** Must specify at least one table
    if (!selectContext.fromTables) {
	throw("checkSelect() -- missing table(s)");
    }
    // *** All tables must be known
    CLAUSE.checkForValidTablesInFromClause(selectContext, selectContext.fromTables);
    
    // *** All columns must be known
    // check for ambiguity at a later stage
    for (let i=0; i<selectContext.columns.length; i++) {
	//console.log("checkSelect() colname=" + selectContext.columns[i].name);

	//console.log("checkSelect() col=" + JSON.stringify(selectContext.columns[i]));
	//console.log("checkSelect() col[i].name=" + selectContext.columns[i].name);
	//console.log("checkSelect() col[i].functionName=" + selectContext.columns[i].functionName);

	if (selectContext.columns[i] instanceof NODES.DisplayColumn) {
	    //selectContext.columns[i].printTree("checkSelect()");
	} else if (selectContext.columns[i] instanceof NODES.Select_Function) {
	    console.log("checkSelect() FUNCTION col=" + JSON.stringify(selectContext.columns[i]));
	    //throw("checkSelect() UNIMPLEMENTED - select function for display");
	    console.log("checkSelect() UNIMPLEMENTED - select function for display");
	    continue;
	} else {
	    console.log("checkSelect() col=" + JSON.stringify(selectContext.columns[i]));
	    throw("checkSelect() column is not a DisplayColumn");
	}

	if (selectContext.columns[i].name == '*') {
	    let cols;
	    if (selectContext.fromTables instanceof NODES.RawJoin) {
		throw("checkSelect() -- UNIMPLEMENTED * with multiple tables (try SELECT table_name.*");
	    }		 
	    if (selectContext.fromTables instanceof NODES.RawTable) {
		let tablename = selectContext.fromTables.name;
		cols = METADATA.getColumns(tablename);
		for (let l=0; l<cols.length; l++) {
		    addColumnToDisplayList(selectContext, cols[l], null, tablename);
		    CLAUSE.addToRequiredList(selectContext, cols[l], tablename);
		}
	    } else {
		throw("checkSelect() -- internal error (not TABLE node)");
	    }
	} else if (selectContext.columns[i].name) {
	    //let displayName = selectContext.columns[i].getDisplayName();
	    if (!selectContext.fromTables) {
		throw("checkSelect() missing tables in FROM");
	    }
	    let parts = selectContext.columns[i].name.split('.');
	    if (parts.length == 1) {
		let colname = selectContext.columns[i].name;
		let alias = selectContext.columns[i].alias;
		let foundColumn = isColumnIn(selectContext, colname, alias, selectContext.fromTables);
		if (foundColumn == false) {
		    throw("Column '" + colname + "' not found in FROM table list");
		}
		addColumnToDisplayList(selectContext, colname, alias);
	    } else if (parts.length == 2) {
		let tblname = parts[0];
		let colname = parts[1];
		//console.log("++ checkSelect() - DOTTED", tblname, colname);
		let colalias = selectContext.columns[i].alias;
		let realTableName = findTableNameFromAlias(selectContext.fromTables, tblname);
		//console.log("checkSelect() real table name " + realTableName + " for table alias " + tblname);
		if (realTableName != null) {
		    //console.log("checkSelect() real table name " + realTableName + " for table/alias " + tblname);
		    // convert to regular identifier
		    selectContext.columns[i].type = 'SQL_COLUMN_VARIABLE';
		    selectContext.columns[i].name = colname;
		    selectContext.columns[i].tableName = realTableName;
		    tblname = realTableName;
		}
		if (METADATA.checkNameOneTable(tblname, colname)) {
		    //console.log("checkSelect() column " + colname + " found in table " + tblname);
		    addColumnToDisplayList(selectContext, colname, colalias);
		    CLAUSE.addToRequiredList(selectContext, colname, tblname);
		} else {
		    throw("Unknown column '" + colname + "' in table " + tblname);
		}
	    } else {
		throw("Unknown column name", parts);
	    }	
	} else if (selectContext.columns[i].functionName) {
	    console.log("checkSelect() col=" + JSON.stringify(selectContext.columns[i]));
	    //console.log("checkSelect() FUNCTION", selectContext.columns[i].functionName);
	    let params = [];
	    for (let p=0; p<selectContext.columns[i].parameters.length; p++) {
		if (selectContext.columns[i].parameters[p].name) {
		    let colname;
		    let parts = selectContext.columns[i].parameters[p].name.split('.');
		    if (parts.length == 1) {
			colname = parts[0];
			console.log("checkSelect() FUNCTION parameters[" + p + "].name", parts[0]);
			let foundColumn = isColumnIn(selectContext, parts[0], '', selectContext.fromTables);
			if (foundColumn == false) {
			    throw("Column '" + parts[0] + "' not found in FROM table list");
			}
			CLAUSE.addToRequiredList(selectContext, parts[0], '');
		    } else if (parts.length == 2) {
			let realTableName = findTableNameFromAlias(selectContext.fromTables, parts[0]);
			if (!realTableName) {
			    throw("Table alias '" + parts[0] + "' not found in FROM table list");
			}
			selectContext.columns[i].tableName = realTableName;
			colname = parts[1];
			console.log("checkSelect() FUNCTION parameters[" + p + "].table .name", realTableName, parts[1]);
			CLAUSE.addToRequiredList(selectContext, parts[1], realTableName);
		    } else {
			throw("Internal error: bad column name " + selectContext.columns[i].parameters[p].name);
		    }
		    let param = {
			"name" : colname,
			"type" : 'SQL_COLUMN_VARIABLE'
		    };
		    params.push(param);
		} else if (selectContext.columns[i].parameters[p].value) {
		    //console.log("checkSelect() FUNC col value=" + JSON.stringify(selectContext.columns[i]));
		    selectContext.columns[i].type = "SQL_NUM_INT";
		    //console.log("checkSelect() FUNCTION parameters[" + p + "].value", selectContext.columns[i].parameters[p].value);
		    //console.log("checkSelect() FUNCTION parameters[" + p + "].type", selectContext.columns[i].parameters[p].propType);
		    let param = {
			"value" : selectContext.columns[i].parameters[p].value,
			"type" : selectContext.columns[i].parameters[p].propType
		    };
		    params.push(param);
		}

		//console.log("checkSelect() FUNCTION parameters[" + p + "]", selectContext.columns[i].parameters[p]);
	    }
	    addFunctionToDisplayList(selectContext, selectContext.columns[i].functionName, selectContext.columns[i].alias, params);
	    //console.log("checkSelect() UNIMPLEMENTED - function on columns");
	    //continue;
	    //throw("checkSelect() UNIMPLEMENTED - function on columns");
	} else {
	    throw("checkSelect() UNIMPLEMENTED - unknown column item");
	}
    }
    
    // TO DO - ORDER BY, GROUP BY, HAVING, etc...
}



// TODO: generalize all tree walkers
// accept action functions?


function findTableName(entry, tableName) {
    if (entry instanceof NODES.RawTable) {
	//console.log("findTableName() table.name", entry.name, "alias =", entry.alias);
	if (tableName == entry.name) {
	    //console.log("findTableName() FOUND table.name", entry.name, "alias =", entry.alias);
	    return true;
	}
	return false;
    } else if (entry instanceof NODES.RawJoin) {
	let val = findTableName(entry.left, tableName);
	if (val != false) return val;
	return findTableName(entry.right, tableName);
    } else {
	console.log("findTableName() unknown node", JSON.stringify(entry));
	throw("findTableName() -- node not 'RawTable' or 'RawJoin'");
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


function findTableNameFromAlias(entry, tableAlias) {
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
	let val = findTableNameFromAlias(entry.left, tableAlias);
	if (val != null) return val;
	return findTableNameFromAlias( entry.right, tableAlias);
    } else {
	console.log("findTableNameFromAlias() unknown node", JSON.stringify(entry));
	throw("findTableNameFromAlias() -- node not 'RawTable' or 'RawJoin'");
    }
}


function isColumnIn(selectContext, colname, alias, entry) {
    //console.log("isColumnIn() node", JSON.stringify(entry));
    if (entry instanceof NODES.RawTable) {
	let tablename = entry.name;
	//console.log("isColumnIn() checking table " + tablename);
	if (METADATA.checkNameOneTable(tablename, colname)) {
	    CLAUSE.addToRequiredList(selectContext, colname, tablename);
	    //console.log("isColumnIn() column " + colname + " found in table " + tablename);
	    return true;
	}
	return false
    } else if (entry instanceof NODES.RawJoin) {
	//console.log("isColumnIn() checking tablejoin");
	return isColumnIn(selectContext, colname, alias, entry.left) || isColumnIn(selectContext, colname, alias, entry.right);
    } else {
	//console.log("isColumnIn() unknown node", JSON.stringify(entry));
	throw("isColumnIn() -- node not 'RawTable' or 'RawJoin'");
    }
}


function addFunctionToDisplayList(selectContext, name, alias, params) {
    // the same column function can appear multiple times
    //console.log("addFunctionToDisplayList()", "name =", name, "alias =", alias);
    let col = new NODES.DisplayColumn();
    col.functionName = name;
    col.alias = alias;
    col.parameters = params;
    selectContext.columnsForDisplay.push(col);
}


function addColumnToDisplayList(selectContext, colname, alias,) {
    // the same column can be repeated
    //console.log("addColumnToDisplayList()", "colname =", colname, "alias =", alias, "table =", table);
    let col = new NODES.DisplayColumn();
    col.name = colname;
    col.alias = alias;
    //col.tableName = table;
    selectContext.columnsForDisplay.push(col);
}
