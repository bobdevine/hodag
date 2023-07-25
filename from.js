"use strict";

// this ~250-line file replaced ~450 lines from the grammar file
// and should be clearer, faster, and give better error messages

const SQL_LEXER = require("./lexer_SQL.js");
const NODES = require("./nodes.js");
const PREDICATE = require("./predicate.js");


//----------------------------------------------------------

exports.parse = function (nodeContext, cmd, tokens, indexTokens) {
    //for (let t in tokens) { console.log("FROM", t, tokens[t][0]); }
    let ret = expression_tables(nodeContext, cmd, tokens, indexTokens);
    return { "status": true, "index": ret.index};
}

//----------------------------------------------------

// 1. single table --> TABLE
// 2. comma-separated implicit joins (old-style syntax) --> CROSS JOIN
// 3. explicit join syntax (ANSI SQL:1992 join syntax) --> many JOIN types    
function expression_tables(nodeContext, cmd, tokens, indexTokens) {
    //console.log("expression_tables");
    let ret = get_table(cmd, tokens, indexTokens);
    indexTokens = ret.index;

    // this assignment will be overwritten if a join is found later
    nodeContext.fromTables = ret.table;
    
    let tableJoin;
    let left = ret.table;

    if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_COMMA") {
	// implict join comma-separated list (in old SQL) --> table, table, ...
	while (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_COMMA") {
	    console.log("expression_tables() token =", tokens[indexTokens][0]);
	    indexTokens += 1;
	    tableJoin = new NODES.RawJoin();
	    tableJoin.joinType = NODES.JOIN_TYPE_CROSS;
	    tableJoin.left = left;
	    ret = get_table(cmd, tokens, indexTokens);
	    tableJoin.right = ret.table;
	    //tableJoin.printTree("TJW");
	    indexTokens = ret.index;
	    left = tableJoin;
	}
	nodeContext.fromTables = tableJoin;
	return {"index": indexTokens};
    } else if (indexTokens < tokens.length && isStartOfJoin(tokens[indexTokens][0])) {
	// explicit joins --> table {join cmd} table
	//console.log("expression_tableList - start EXPLICIT");
	while (indexTokens < tokens.length && isStartOfJoin(tokens[indexTokens][0])) {
	    ret = getJoinType(tokens, indexTokens);
	    //console.log("expression_tableList - get_table() ret", JSON.stringify(ret));
	    indexTokens = ret.index;
	    
	    if (ret.jointype == NODES.JOIN_TYPE_NONE) {
		return {"index": indexTokens};
	    }
	    
	    //console.log("expression_tables EXPLICIT token=", tokens[indexTokens][0]);
	    tableJoin = new NODES.RawJoin();
	    tableJoin.joinType = ret.jointype;
	    tableJoin.left = left;
	    ret = get_table(cmd, tokens, indexTokens);
	    //console.log("expression_tables - EXPLICIT get_table() ret", JSON.stringify(ret));
	    indexTokens = ret.index;
	    tableJoin.right = ret.table;
	    
	    indexTokens = optionalJoinClauses(tableJoin, cmd, tokens, indexTokens);
	    //console.log("tableJoin = ", JSON.stringify(tableJoin));
	    
	    left = tableJoin; // add tables in left-deep tree order
	    //tableJoin.printTree("RAW");
	}
	
	//console.log("expression_tables - adding node", JSON.stringify(tableJoin));
	nodeContext.fromTables = tableJoin;
    }

    if (!nodeContext.fromTables) {
	console.log("expression_tables - NO TABLES");
    }

    return {"index": indexTokens};
}


function optionalJoinClauses(tableJoin, cmd, tokens, indexTokens) {
    //console.log("optionalJoinClauses() tok =", tokens[indexTokens][0]);
    // can have an ON clause or USING clause, but not both
    if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_ON") {
	//console.log("join_on_expression()");
	indexTokens += 1;
	let ret = PREDICATE.parse_OnClause(cmd, tokens, indexTokens);
	//console.log("JOIN ON CLAUSE = " + JSON.stringify(ret));
	tableJoin.onClause = ret.node;
	return ret.index;
    } else if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_USING") {
	//console.log("join_using_expression()");
	indexTokens += 1;
	let ret = PREDICATE.parse_UsingClause(cmd, tokens, indexTokens);
	//console.log("JOIN USING CLAUSE = " + JSON.stringify(ret));
	tableJoin.usingClause = ret.node;
	return ret.index;
    }
    return indexTokens;
}

// There are three new join types in Oracle 12c: Lateral, Cross Apply, Outer Apply
function isStartOfJoin(tok) {
    switch (tok) {
    case "LEX_KEYWORD_JOIN":
    case "LEX_KEYWORD_INNER":
    case "LEX_KEYWORD_OUTER":
    case "LEX_KEYWORD_LEFT":
    case "LEX_KEYWORD_RIGHT":
    case "LEX_KEYWORD_FULL":
    case "LEX_KEYWORD_NATURAL":
    case "LEX_KEYWORD_UNION":
    case "LEX_KEYWORD_CROSS":
	return true;
    default:
	return false;
    }
}

function get_table(cmd, tokens, indexTokens) {
    //console.log("get_table token=", tokens[indexTokens][0]);
    let table;
    if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_IDENTIFIER") {
	table = new NODES.RawTable();
	let posStart = tokens[indexTokens][1];
        let posEnd = posStart + tokens[indexTokens][2];
	table.name = cmd.slice(posStart, posEnd);
	table.alias = "";
	indexTokens += 1;
	if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_IDENTIFIER") {
	    posStart = tokens[indexTokens][1];
            posEnd = posStart + tokens[indexTokens][2];
	    table.alias = cmd.slice(posStart, posEnd);
	    indexTokens += 1;
	}
	//table.printTree("GetT");
    }
    return {"table": table, "index": indexTokens};
}

function getJoinType(tokens, indexTokens) {
    //console.log("getJoinType() token type=" + tokens[indexTokens][0]);
    // T1 NATURAL { [INNER] | { LEFT | RIGHT | FULL } [OUTER] } JOIN T2
    // T1 { [INNER] | { LEFT | RIGHT | FULL } [OUTER] } JOIN T2 ON expression
    // T1 { [INNER] | { LEFT | RIGHT | FULL } [OUTER] } JOIN T2 USING ( col list )
    let index = indexTokens;
    let joinType = NODES.JOIN_TYPE_NONE;

    if (indexTokens < tokens.length && tokens[index][0] == "LEX_KEYWORD_CROSS") {
	joinType = NODES.JOIN_TYPE_CROSS;
	index += 1;
	if (index < tokens.length && tokens[index][0] == "LEX_KEYWORD_JOIN") {
	    return {"jointype": joinType, "index": index+1};
	} else {
	    throw("Missing 'JOIN' keyword for CROSS join");
	}
    } else if (indexTokens < tokens.length && tokens[index][0] == "LEX_KEYWORD_UNION") {
	joinType = NODES.JOIN_TYPE_UNION;
	index += 1;
	if (index < tokens.length && tokens[index][0] == "LEX_KEYWORD_JOIN") {
	    return {"jointype": joinType, "index": index+1};
	} else {
	    throw("Missing 'JOIN' keyword for UNION join");
	}
    }
    
    if (indexTokens < tokens.length && tokens[index][0] == "LEX_KEYWORD_NATURAL") {
	joinType = NODES.JOIN_TYPE_NATURAL;
	index += 1;
	if (index >= tokens.length) {
	    throw("Incomplete JOIN keywords for NATURAL join");
	}
    }

    if (indexTokens >= tokens.length) {
	return {"jointype": NODES.JOIN_TYPE_NONE, "index": index};
    }

    switch (tokens[index][0]) {
    case "LEX_KEYWORD_JOIN":
	joinType |= NODES.JOIN_TYPE_INNER;
	index += 1;
	return {"jointype": joinType, "index": index};
    case "LEX_KEYWORD_INNER":
	joinType |= NODES.JOIN_TYPE_INNER;
	index += 1;
	if (index < tokens.length && tokens[index][0] == "LEX_KEYWORD_JOIN") {
	    return {"jointype": joinType, "index": index+1};
	} else {
	    throw("Missing 'JOIN' keyword for INNER join");
	}
    case "LEX_KEYWORD_OUTER":
	joinType |= NODES.JOIN_TYPE_OUTER_FULL;
	index += 1;
	if (index < tokens.length && tokens[index][0] == "LEX_KEYWORD_JOIN") {
	    return {"jointype": joinType, "index": index+1};
	} else {
	    throw("Missing 'JOIN' keyword for OUTER join");
	}
    case "LEX_KEYWORD_LEFT":
	joinType |= NODES.JOIN_TYPE_OUTER_LEFT;
	index += 1;
	console.log("getJoinType() LEFT " + tokens[index][0]);
	if (index < tokens.length && tokens[index][0] == "LEX_KEYWORD_OUTER") {
	    // optional..
	    index += 1;
	}
	console.log("getJoinType() LEFT OUTER " + tokens[index][0]);
	if (index >= tokens.length || tokens[index][0] != "LEX_KEYWORD_JOIN") {
	    throw("Missing 'JOIN' keyword for LEFT OUTER JOIN");
	}
	return {"jointype": joinType, "index": index+1};
    case "LEX_KEYWORD_RIGHT":
	joinType |= NODES.JOIN_TYPE_OUTER_RIGHT;
	index += 1;
	if (index < tokens.length && tokens[index][0] == "LEX_KEYWORD_OUTER") {
	    // optional..
	    index += 1;
	}
	if (index >= tokens.length || tokens[index][0] != "LEX_KEYWORD_JOIN") {
	    throw("Missing 'JOIN' keyword for RIGHT OUTER JOIN");
	}
	return {"jointype": joinType, "index": index+1};
    case "LEX_KEYWORD_FULL":
	joinType |= NODES.JOIN_TYPE_OUTER_FULL;
	index += 1;
	if (index < tokens.length && tokens[index][0] == "LEX_KEYWORD_OUTER") {
	    // optional..
	    index += 1;
	}
	if (index >= tokens.length || tokens[index][0] != "LEX_KEYWORD_JOIN") {
	    throw("Missing 'JOIN' keyword for FULL OUTER JOIN");
	}
	return {"jointype": joinType, "index": index+1};
    default:
	throw("Unknown join");
    }
}
