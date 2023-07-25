"use strict";

const SQL_LEXER = require("./lexer_SQL.js");
const NODES = require("./nodes.js");
const PREDICATE = require("./predicate.js");
const METADATA = require("./metadata.js");


//----------------------------------------------------------
// CREATE TABLE table_name (
//    column1 datatype constraint,
//    column2 datatype constraint,
//    column3 datatype constraint,
//    ....
// );

exports.parse_column_definition = function(nodeContext, cmd, tokens, indexTokens) {
    //for (let t in tokens) { console.log("CREATE", t, tokens[t][0]); }
    let ret = expression_column_definition(nodeContext, cmd, tokens, indexTokens);
    return { "status": true, "index": ret.index};
}


function expression_column_definition(nodeContext, cmd, tokens, indexTokens) {
    //console.log("expression_column_definition");

    if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_PAREN_OPEN") {
	indexTokens += 1;
    } else {
	throw("Expected '(', got " + tokens[indexTokens][0]);
    }

    const tbl = new METADATA.metadata_table();
    tbl.tablename = nodeContext.tablename;

    // parse "create table" body
    // <lparen> <table element> ( <comma> <table element> )* <rparen>
    // <table element> can be a constraint or a column definition
    let ret;
    while (indexTokens < tokens.length && tokens[indexTokens][0] != "LEX_PAREN_CLOSE") {
	if (tokens[indexTokens][0] == "LEX_KEYWORD_CONSTRAINT") {
	    ret = getTableConstraint(tbl, cmd, tokens, indexTokens);
	    indexTokens = ret.index;
	} else if (tokens[indexTokens][0] == "LEX_KEYWORD_PRIMARY") {
	    ret = getTableConstraint_PrimaryKey(tbl, cmd, tokens, indexTokens);
	    indexTokens = ret.index;
	} else if (tokens[indexTokens][0] == "LEX_KEYWORD_FOREIGN") {
	    ret = getTableConstraint_ForeignKey(tbl, cmd, tokens, indexTokens);
	    indexTokens = ret.index;
	} else {
	    // column definition
	    let col = new METADATA.metadata_column();
	    ret = getColumnName(col, cmd, tokens, indexTokens);
	    indexTokens = ret.index;
	    ret = getColumnType(col, cmd, tokens, indexTokens);
	    indexTokens = ret.index;
	    if  (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_PAREN_CLOSE") {
		tbl.columns.push(col);
		break;
	    } else if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_COMMA") {
		tbl.columns.push(col);
		indexTokens += 1;
	    } else {
		ret = getColumnConstraint(col, cmd, tokens, indexTokens);
		indexTokens = ret.index;
		if (indexTokens < tokens.length && tokens[indexTokens][0] != "LEX_COMMA") {
		    throw("Expected a comma in create table definitions");
		} else {
		    indexTokens += 1;
		}
		tbl.columns.push(col);
	    }
	}
    }

    if (indexTokens >= tokens.length || tokens[indexTokens][0] != "LEX_PAREN_CLOSE") {
	throw("Incomplete command. Missing ')' at end of column definitions");
    } else {
	indexTokens += 1;
    }

    nodeContext.newTable = tbl;

    return {"index": indexTokens};
}


// Table constraints:
//    PRIMARY KEY - Uniquely identifies each row (combines NOT NULL and UNIQUE)
//             CREATE TABLE Persons (
//               ID int NOT NULL,
//               PRIMARY KEY (ID)
//             ); 
//    FOREIGN KEY - Prevents actions that would destroy links between tables
//             CREATE TABLE Orders (
//               OrderID int NOT NULL,
//               PersonID int,
//               PRIMARY KEY (OrderID),
//               FOREIGN KEY (PersonID) REFERENCES Persons(PersonID)
//             );
function getTableConstraint(tbl, cmd, tokens, indexTokens) {
    console.log("getTableConstraint", tokens[indexTokens][0]);

    indexTokens += 1;
    return {"index" : indexTokens};
}


function getTableConstraint_PrimaryKey(tbl, cmd, tokens, indexTokens) {
    // PRIMARY KEY (col)
    // PRIMARY KEY (col, col)
    console.log("getTableConstraint_PrimaryKey", tokens[indexTokens][0]);

    indexTokens += 1;
    if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_KEY") {
	indexTokens += 1;
    } else {
	throw("Expected 'KEY', got " + tokens[indexTokens][0]);
    }

    if (indexTokens >= tokens.length && tokens[indexTokens][0] != "LEX_PAREN_OPEN") {
	throw("PRIMARY KEY requires column list in parentheses, missing '('");
    }
    indexTokens += 1;

    let key = new METADATA.metadata_key();
    key.keyType = "PRIMARY";
    while (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_IDENTIFIER") {
	let posStart = tokens[indexTokens][1];
	let posEnd = posStart + tokens[indexTokens][2];
	let str = cmd.slice(posStart, posEnd);
	key.columns.push(str);
	indexTokens += 1;

	if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_COMMA") {
	    indexTokens += 1;
	}
    }
    if (indexTokens >= tokens.length || tokens[indexTokens][0] != "LEX_PAREN_CLOSE") {
	throw("PRIMARY KEY requires column list in parentheses, missing ')'");
    }
    indexTokens += 1;
    tbl.keys.push(key);
	   
    return {"index" : indexTokens};
}


function getTableConstraint_ForeignKey(tbl, cmd, tokens, indexTokens) {
    console.log("getTableConstraint_ForeignKey", tokens[indexTokens][0]);

    indexTokens += 1;
    if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_KEY") {
	indexTokens += 1;
    } else {
	throw("Expected 'KEY', got " + tokens[indexTokens][0]);
    }
    return {"index" : indexTokens};
}


function getColumnName(col, cmd, tokens, indexTokens) {
    let posStart = tokens[indexTokens][1];
    let posEnd = posStart + tokens[indexTokens][2];
    let str = cmd.slice(posStart, posEnd);

    //console.log("getColumnName", tokens[indexTokens][0], str);

    if (tokens[indexTokens][0] != "LEX_IDENTIFIER") {
	throw("Expected an identifer name in column definitions, got '" + str + "'");
    }

    col.name = str;

    indexTokens += 1;
    return {"index" : indexTokens};
}


function getColumnType(col, cmd, tokens, indexTokens) {
    let posStart = tokens[indexTokens][1];
    let posEnd = posStart + tokens[indexTokens][2];
    let str = cmd.slice(posStart, posEnd);
    
    //console.log("getColumnType", tokens[indexTokens][0], str);

    switch (tokens[indexTokens][0]) {
    case "LEX_KEYWORD_VARCHAR":
    case "LEX_KEYWORD_NVARCHAR":
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	col.varying = true;
	indexTokens += 1;
	if ((indexTokens + 3) < tokens.length && tokens[indexTokens][0] == "LEX_PAREN_OPEN") {
	    indexTokens += 1;
	    //console.log("getColumnType CHAR precision", tokens[indexTokens][0]);
	    if (tokens[indexTokens][0] != "LEX_NUM_INT") {
		throw("Expected precision field for type " + str);
	    }
	    posStart = tokens[indexTokens][1];
	    posEnd = posStart + tokens[indexTokens][2];
	    col.typePrecision = cmd.slice(posStart, posEnd); // convert from string?
	    indexTokens += 1;
	    if (tokens[indexTokens][0] != "LEX_PAREN_CLOSE") {
		throw("Expected closing parenthesis for type " + str);
	    }
	    indexTokens += 1;
	}
	break;
    case "LEX_KEYWORD_BIT":
    case "LEX_KEYWORD_CHAR":
    case "LEX_KEYWORD_NCHAR":
    case "LEX_KEYWORD_CHARACTER":
	// type [VARYING] [ ( length ) ]
	//for (let t in tokens) { console.log("CREATE", t, tokens[t][0]); }
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	//console.log("getColumnType CHAR", tokens[indexTokens][0]);

	if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_VARYING") {
	    indexTokens += 1;
	    col.varying = true;
	}
	if ((indexTokens + 3) < tokens.length && tokens[indexTokens][0] == "LEX_PAREN_OPEN") {
	    indexTokens += 1;
	    //console.log("getColumnType CHAR precision", tokens[indexTokens][0]);
	    if (tokens[indexTokens][0] != "LEX_NUM_INT") {
		throw("Expected precision field for type " + str);
	    }
	    posStart = tokens[indexTokens][1];
	    posEnd = posStart + tokens[indexTokens][2];
	    col.typePrecision = cmd.slice(posStart, posEnd); // convert from string?
	    indexTokens += 1;
	    if (tokens[indexTokens][0] != "LEX_PAREN_CLOSE") {
		throw("Expected closing parenthesis for type " + str);
	    }
	    indexTokens += 1;
	} else {
	    if (col.varying == true) {
		throw("Missing size for VARYING type " + str);
	    }
	}
	break;
    case "LEX_KEYWORD_BINARY":
    case "LEX_KEYWORD_SMALLINT":
    case "LEX_KEYWORD_INT":
    case "LEX_KEYWORD_INTEGER":
    case "LEX_KEYWORD_REAL":
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	break;
    case "LEX_KEYWORD_NUMERIC":
    case "LEX_KEYWORD_DECIMAL":
    case "LEX_KEYWORD_DEC":
	// type ( precision [,scale] )
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	if ((indexTokens + 3) >= tokens.length || tokens[indexTokens][0] != "LEX_PAREN_OPEN") {
	    throw("Missing precision field for type " + str);
	}
	indexTokens += 1;
	if (tokens[indexTokens][0] != "LEX_NUM_INT") {
	    throw("Expected precision field for type " + str);
	}
	posStart = tokens[indexTokens][1];
	posEnd = posStart + tokens[indexTokens][2];
	col.typePrecision = cmd.slice(posStart, posEnd); // convert from string?
	indexTokens += 1;
	if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_COMMA") {
	    indexTokens += 1;
	    if (indexTokens >= tokens.length || tokens[indexTokens][0] != "LEX_NUM_INT") {
		throw("Bad scale field for type " + str);
	    }
	    posStart = tokens[indexTokens][1];
	    posEnd = posStart + tokens[indexTokens][2];
	    col.typeScale = cmd.slice(posStart, posEnd); // convert from string?
	    indexTokens += 1;
	}
	if (indexTokens >= tokens.length || tokens[indexTokens][0] != "LEX_PAREN_CLOSE") {
	    throw("Expected closing parenthesis for type " + str);
	}
	indexTokens += 1;
	break;
    case "LEX_KEYWORD_FLOAT":
	// FLOAT [ ( precision ) ]
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	break;
    case "LEX_KEYWORD_TEXT":
    case "LEX_KEYWORD_NTEXT":
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	break;
    case "LEX_KEYWORD_DOUBLE":
	// "DOUBLE PRECISION"
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	break;
    case "LEX_KEYWORD_FLOAT":
    case "LEX_KEYWORD_MONEY":
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	break;
    case "LEX_KEYWORD_DATE":
    case "LEX_KEYWORD_DATETIME":
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	break;
    case "LEX_KEYWORD_TIME":
    case "LEX_KEYWORD_TIMESTAMP":
	// TIME [ ( int ) ] [ WITH TIME ZONE ]
	// TIMESTAMP [ ( int ) ] [ WITH TIME ZONE ]
	// TODO - spend a week parsing this mess...
	col.type = METADATA.convertType(tokens[indexTokens][0]);
	indexTokens += 1;
	break;
    default:
	throw("Unknown type: '" + tokens[indexTokens][0] + "' input: '" + str + "'");
    }
    return {"index" : indexTokens};
}

// Column constraints:
// The following constraints are commonly used in SQL:
//    DEFAULT - Sets a column's default value if no value is specified
//              CREATE TABLE Persons (
//                 City varchar(255) DEFAULT 'Boston'
//              ); 
//    NOT NULL - Ensures that a column cannot have a NULL value
//             By default, a column can hold NULL values.
//    UNIQUE - Ensures that all values in a column are different
//             The UNIQUE constraint ensures that all values in a column are different.
//             Both the UNIQUE and PRIMARY KEY constraints provide a guarantee for
//             uniqueness for a column or set of columns.
//             A PRIMARY KEY constraint automatically has a UNIQUE constraint.
//             However, you can have many UNIQUE constraints per table,
//             but only one PRIMARY KEY constraint per table.
//    CHECK - Ensures that the values in a column satisfies a specific condition
//         MySQL:
//             CREATE TABLE Persons (
//               Age int,
//               CHECK (Age>=18)
//             );
//         SQL Server / Oracle / MS Access:
//             CREATE TABLE Persons (
//               Age int CHECK (Age>=18)
//             );
//         MySQL / SQL Server / Oracle / MS Access:
//             CREATE TABLE Persons (
//               Age int,
//               City varchar(255),
//               CONSTRAINT CHK_Person CHECK (Age>=18 AND City='Boston')
//             );
function getColumnConstraint(col, cmd, tokens, indexTokens) {
    let posStart = tokens[indexTokens][1];
    let posEnd = posStart + tokens[indexTokens][2];
    let str = cmd.slice(posStart, posEnd);
    console.log("getColumnConstraints", tokens[indexTokens][0], str);
    
    if (tokens[indexTokens][0] == "LEX_KEYWORD_NOT") {
	indexTokens += 1;
	if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_NULL") {
	    indexTokens += 1;;
	    col.constraintNotNull = true;
	} else {
	}
    } else if (tokens[indexTokens][0] == "LEX_KEYWORD_UNIQUE") {
	indexTokens += 1;
	col.constraintUnique = true;
    } else if (tokens[indexTokens][0] == "LEX_KEYWORD_CHECK") {
	indexTokens += 1;
    } else {
	throw("Unknown column constraint '" + str + "'");
    }

    return {"index" : indexTokens};
}


//----------------------------------------------------


// build optimizable tree from CREATE context block
exports.makeTree = function(contextCreate) {
    //console.log("makeTree() - contextCreate " + JSON.stringify(contextCreate));

    // build top-level node for execution
    let createNode = new NODES.Create();
    if (contextCreate.operation.toUpperCase() == "TABLE") {
	createNode.operation = "TABLE";
	createNode.newTable = contextCreate.newTable;
    } else {
	throw("CREATE '" + contextCreate.operation + "' OPERATION IS NOT IMPLEMENTED");
    }

    return createNode;    
}
