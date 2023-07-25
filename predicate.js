"use strict";

const SQL_LEXER = require("./lexer_SQL.js");
const NODES = require("./nodes.js");


//----------------------------------------------------------

exports.parse_Where = function (cmd, tokens, indexTokens) {
    //for (let t in tokens) { console.log(tokens[t][0]); }
    return expression_or(cmd, tokens, indexTokens);
}

exports.parse_OnClause = function (cmd, tokens, indexTokens) {
    return expression_comparison(cmd, tokens, indexTokens);
}

exports.parse_UsingClause = function (cmd, tokens, indexTokens) {
    //console.log("parseUsing()");
    //for (let t in tokens) { console.log(tokens[t][0]); }
    if (indexTokens >= tokens.length && tokens[indexTokens][0] != "LEX_PAREN_OPEN") {
	throw("USING requires column list in parentheses, missing '('");
    }
    indexTokens += 1;
    let listUsing = [];
    while (indexTokens < tokens.length &&
	   (tokens[indexTokens][0] == "LEX_IDENTIFIER" || tokens[indexTokens][0] == "LEX_DOTTED_IDENTIFIER")) {
	let posStart = tokens[indexTokens][1];
	let posEnd = posStart + tokens[indexTokens][2];
	let str = cmd.slice(posStart, posEnd);
	listUsing.push(str);
	indexTokens += 1;

	if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_COMMA") {
	    indexTokens += 1;
	}
    }
    if (indexTokens >= tokens.length || tokens[indexTokens][0] != "LEX_PAREN_CLOSE") {
	throw("USING requires column list in parentheses, missing ')'");
    }
    indexTokens += 1;
    return {"node": listUsing, "index": indexTokens};
}

//----------------------------------------------------------

function expression_or(cmd, tokens, indexTokens) {
    let ret = expression_and(cmd, tokens, indexTokens);
    let left = ret.node;
    indexTokens = ret.index;
    while (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_OR") {
	//console.log("expression_or token=", tokens[indexTokens][0]);
	let opLog = new NODES.Operator_Logical();
	opLog.operator = tokens[indexTokens][0];
	opLog.left = left;
	indexTokens += 1;
	let ret = expression_and(cmd, tokens, indexTokens);
	opLog.right = ret.node;
	indexTokens = ret.index;
	left = opLog;
    }
    return {"node": left, "index": indexTokens};
}


function expression_and(cmd, tokens, indexTokens) {
    let ret = expression_comparison(cmd, tokens, indexTokens);
    let left = ret.node;
    indexTokens = ret.index;
    while (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_AND") {
	//console.log("expression_and token=", tokens[indexTokens][0]);
	let opLog = new NODES.Operator_Logical();
	opLog.operator = tokens[indexTokens][0];
	opLog.left = left;
	indexTokens += 1;
	let ret = expression_comparison(cmd, tokens, indexTokens);
	opLog.right = ret.node;
	indexTokens = ret.index;
	left = opLog;
    }
    return {"node": left, "index": indexTokens};
}


function expression_comparison(cmd, tokens, indexTokens) {
    let ret = expression_additive(cmd, tokens, indexTokens);
    let left = ret.node;
    indexTokens = ret.index;
    while (indexTokens < tokens.length && isComparison(tokens[indexTokens][0])) {
	let opLog = new NODES.Operator_Comparison();
	opLog.operator = tokens[indexTokens][0];
	opLog.left = left;
	indexTokens += 1;
	let ret;
	//console.log("expression_Comparison() token type=" + opLog.operator);
	if (opLog.operator == "LEX_KEYWORD_IN") {
	    ret = expression_in(cmd, tokens, indexTokens);
	    //ret.node.printTree("IN");
	} else if (opLog.operator == "LEX_KEYWORD_IS") {
	    ret = expression_is(cmd, tokens, indexTokens);
	} else if (opLog.operator == "LEX_KEYWORD_LIKE") {
	    ret = expression_like(cmd, tokens, indexTokens);
	} else if (opLog.operator == "LEX_KEYWORD_BETWEEN") {
	    ret = expression_between(cmd, tokens, indexTokens);
	} else {
	    ret = expression_additive(cmd, tokens, indexTokens);
	}
	opLog.right = ret.node;
	indexTokens = ret.index;
	left = opLog;
    }
    //left.printTree("IN left");
    return {"node": left, "index": indexTokens};
}


function isComparison(tokType) {
    //console.log("isComparison() token type=" + tokType);
    switch (tokType) {
    case "LEX_LESS":
    case "LEX_LESS_EQUAL":
    case "LEX_GREATER":
    case "LEX_GREATER_EQUAL":
    case "LEX_EQUAL":
    case "LEX_NOT_EQUAL":
    case "LEX_KEYWORD_IN":
    case "LEX_KEYWORD_IS":
    case "LEX_KEYWORD_LIKE":
    case "LEX_KEYWORD_BETWEEN":
	return true;
    default:
	return false;
    }
}


function expression_in(cmd, tokens, indexTokens) {
    // IN (val, val, val)
    //console.log("expression_in()");
    //indexTokens += 1;
    let tok = tokens[indexTokens];
    //console.log("expression_in() token=" + tok[0]);
    if (tok[0] != "LEX_PAREN_OPEN") {
	throw("Error: 'in' expression expects a parenthesized list");
    }

    let opArray = new NODES.OperandArray();
    
    // TO DO: better parsing to catch (a,b,) (a,,b) (,)
    for (let i=indexTokens+1; i<tokens.length; i++) {
	switch (tokens[i][0]) {
	case "LEX_NUM_INT":
	case "LEX_STRING":
	    let op = new NODES.Operand();
	    let posStart = tokens[i][1];
	    let posEnd = posStart + tokens[i][2];
	    op.name = "";
	    op.type = tokens[i][0];
	    op.value = cmd.slice(posStart, posEnd);
	    //console.log("expression_in() value", op.value);
	    opArray.values.push(op);
	    break;
	case "LEX_COMMA":
	    break;
	case "LEX_PAREN_CLOSE":
	    return {"node": opArray, "index": indexTokens+i};
	default:
	    throw("Error: 'in' expression has syntax error at " + tokens[i][0]);
	}
    }
    throw("Error: 'in' expression missing a closing parenthesis");

    return {"node": opArray, "index": indexTokens};
}

function expression_is(cmd, tokens, indexTokens) {
    // IS [NOT] ( TRUE | FALSE | UNKNOWN )
    // NULL == NULL => UNKNOWN
    //console.log("expression_is()");
    let tok = tokens[indexTokens];
    //console.log("expression_is() token=" + tok[0]);
    let isOperand = new NODES.Operand();
    let isTree = isOperand;
    if (tok[0] == "LEX_KEYWORD_NOT") {
	let opLogNot = new NODES.Operator_Logical_Not();
	opLogNot.operator = "LEX_KEYWORD_NOT"; // add for internal error-checking
	opLogNot.child = isOperand;
	isTree = opLogNot;
	indexTokens += 1;
	tok = tokens[indexTokens];
    }
    //console.log("expression_is() token=" + tok[0]);
    let posStart = tokens[indexTokens][1];
    let posEnd = posStart + tokens[indexTokens][2];
    switch (tok[0]) {
    case "LEX_KEYWORD_TRUE":
    case "LEX_KEYWORD_FALSE":
    case "LEX_KEYWORD_NULL":
    case "LEX_KEYWORD_UNKOWN":
	isOperand.type = tok[0];
	isOperand.value = cmd.slice(posStart, posEnd);
	break;
    default:
	throw("Invalid 'is' argumemt " + cmd.slice(posStart, posEnd) + ' (' + tok[0] + ')');
    }

    return {"node": isTree, "index": indexTokens};
}

function expression_like(cmd, tokens, indexTokens) {
    //console.log("expression_like()");
    let tok = tokens[indexTokens];
    //console.log("expression_like() token=" + tok[0]);
    if (tok[0] != "LEX_STRING") {
	throw("Error: 'like' operator expects a string");
    }
    return expression_term(cmd, tokens, indexTokens);
}


function expression_between(cmd, tokens, indexTokens) {
    let tok = tokens[indexTokens];
    //console.log("expression_between()", tok[0]);
    let opBetween = new NODES.Operator_Between();
    opBetween.type = "BETWEEN_RANGE"; // used for self-document
    let ret = expression_term(cmd, tokens, indexTokens);
    opBetween.left = ret.node;
    indexTokens = ret.index;
    //console.log("expression_between() token = " + tokens[indexTokens][0]);
    if (indexTokens < tokens.length && tokens[indexTokens][0] == "LEX_KEYWORD_AND") {
	indexTokens += 1;
	let ret = expression_additive(cmd, tokens, indexTokens);
	opBetween.right = ret.node;
	indexTokens = ret.index;	
	return {"node": opBetween, "index": indexTokens};
    } else {
	throw("'between' expression syntax error");
    }
}

function expression_additive(cmd, tokens, indexTokens) {
    let ret = expression_multiplicative(cmd, tokens, indexTokens);
    let left = ret.node;
    indexTokens = ret.index;
    while (indexTokens < tokens.length && isAdditive(tokens[indexTokens][0])) {
	let op = new NODES.Operator_Math();
	op.operator = tokens[indexTokens][0];
	op.left = left;
	indexTokens += 1;
	let ret = expression_multiplicative(cmd, tokens, indexTokens);
	op.right = ret.node;
	indexTokens = ret.index;
	left = op;
    }
    return {"node": left, "index": indexTokens};
}

function isAdditive(tokType) {
    //console.log("isAdditive() token type=" + tokType);
    if (tokType == "LEX_PLUS") {
	return true;
    } else if (tokType == "LEX_MINUS") {
	return true;
    } else {
	return false;
    }
}

function expression_multiplicative(cmd, tokens, indexTokens) {
    let ret = expression_term(cmd, tokens, indexTokens);
    let left = ret.node;
    indexTokens = ret.index;
    while (indexTokens < tokens.length && isMultiplicative(tokens[indexTokens][0])) {
	let op = new NODES.Operator_Math();
	op.operator = tokens[indexTokens][0];
	op.left = left;
	indexTokens += 1;
	let ret = expression_term(cmd, tokens, indexTokens);
	op.right = ret.node;
	indexTokens = ret.index;
	left = op;
    }
    return {"node": left, "index": indexTokens};
}

function isMultiplicative(tokType) {
    //console.log("isMultiplicative() token type=" + tokType);
    if (tokType == "LEX_STAR") {
	return true;
    } else if (tokType == "LEX_DIVIDE") {
	return true;
    } else {
	return false;
    }
}


// handle a TERM, and convert from internal lexer/parser name to external name
function expression_term(cmd, tokens, indexTokens) {
    if (indexTokens >= tokens.length) {
	throw("Syntax error, missing TERM");
	//return {"node": null, "index": indexTokens};
    }
    let tok = tokens[indexTokens];
    console.log("expression_term() token=" + tok[0]);
    let operand = new NODES.Operand();
    let posStart = tok[1];
    let posEnd = posStart + tok[2];

    switch (tok[0]) {
    case "LEX_KEYWORD_TRUE":
    case "LEX_KEYWORD_FALSE":
    case "LEX_KEYWORD_NULL":
    case "LEX_KEYWORD_UNKNOWN":
    case "LEX_NUM_FLOAT":
    case "LEX_NUM_INT":
    case "LEX_DOTTED_IDENTIFIER":
    case "LEX_IDENTIFIER":
    case "LEX_STRING":
	switch (tok[0]) {
	case "LEX_KEYWORD_TRUE":
	case "LEX_KEYWORD_FALSE":
	case "LEX_KEYWORD_NULL":
	case "LEX_KEYWORD_UNKNOWN":
	    operand.type = "SQL_TRUTH_VALUE";
	    operand.value = cmd.slice(posStart, posEnd);
	    break;
	case "LEX_NUM_FLOAT":
	    operand.type = "SQL_NUM_FLOAT";
	    operand.value = cmd.slice(posStart, posEnd);
	    break;
	case "LEX_NUM_INT":
	    operand.type = "SQL_NUM_INT";
	    operand.value = cmd.slice(posStart, posEnd);
	    break;
	case "LEX_DOTTED_IDENTIFIER":
	    operand.type = "SQL_COLUMN_VARIABLE";
	    let name = cmd.slice(posStart, posEnd);
	    let names = name.split('.');
	    operand.tableName = names[0];
	    operand.name = names[1];
	    operand.value = null;
	    break;
	case "LEX_IDENTIFIER":
	    operand.type = "SQL_COLUMN_VARIABLE";
	    operand.tableName = null;
	    operand.name = cmd.slice(posStart, posEnd);
	    operand.value = null;
	    break;
	case "LEX_STRING":
	    operand.type = "SQL_STRING";
	    operand.value = cmd.slice(posStart, posEnd);
	    break;
	default:
	    throw("predicate:expression_term() -- unknown tok[0] '" + tok[0] + "'");
	}

        return {"node": operand, "index": indexTokens+1};

    case "LEX_KEYWORD_NOT":
	operand = new NODES.Operator_Logical_Not();
        return {"node": operand, "index": indexTokens+1};

    case "LEX_KEYWORD_AND":
    case "LEX_KEYWORD_OR":
	operand = new NODES.Operator_Logical();
	posStart = tokens[indexTokens][1];
        posEnd = posStart + tokens[indexTokens][2];
        operand.value = cmd.slice(posStart, posEnd);
        return {"node": operand, "index": indexTokens+1};
	
    case "LEX_PAREN_OPEN":
	let parenCount = 1;
	let parenTokens = [];
	for (let i=indexTokens+1; i< tokens.length; i++) {
	    if (tokens[i][0] == "LEX_PAREN_OPEN") {
		parenCount += 1;
	    } else if (tokens[i][0] == "LEX_PAREN_CLOSE") {
		parenCount -= 1;
		if (parenCount == 0) {
		    break;
		}
	    }
	    let token = ['', 0, 0];
	    token[0] = tokens[i][0];
	    token[1] = tokens[i][1];
	    token[2] = tokens[i][2];
	    parenTokens.push(token);
	    indexTokens += 1;
	}
	let group = exports.parse(cmd, parenTokens, 0);
	return {"node": group.node, "index": indexTokens+2};

    default:
	throw("predicate:expression_term() -- unknown type '" + tok[0] + "'");
    }
}


//==================================================


exports.convertPredicateTree = function (tables, obj) {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;

    if (obj instanceof NODES.Operand) {
        return convertPredicate_Operand(tables, obj);
    } else if (obj instanceof NODES.OperandArray) {
        return convertPredicate_OperandArray(tables, obj);
    } else if (obj instanceof NODES.Operator_Comparison) {
        return convertPredicate_OperatorComparison(tables, obj);
    } else if (obj instanceof NODES.Operator_Logical) {
        return convertPredicate_OperatorLogical(tables, obj);
    } else if (obj instanceof NODES.Operator_Between) {
        return convertPredicate_OperatorBetween(tables, obj);
    } else if (obj instanceof NODES.Operator_In) {
        return convertPredicate_OperatorIn(tables, obj);
    } else {
        console.error("convertPredicateTree() unknown obj", obj.constructor());
	obj.printTree();
        return null;
    }
}

function convertPredicate_OperatorComparison(tables, obj) {
    //console.log("comparison operator =", obj.operator);
    let clone = new NODES.Operator_Comparison();
    clone.operator = obj.operator;
    clone.left = exports.convertPredicateTree(tables, obj.left);
    clone.right = exports.convertPredicateTree(tables, obj.right);
    //console.log("comparison operator - clone");
    clone.printTree("pred");
    return clone;
}

function convertPredicate_OperatorIn(tables, obj) {
    //console.log("operator IN", obj.operator);
    let clone = new NODES.Operator_In();
    clone.operator = obj.operator;
    clone.left = exports.convertPredicateTree(tables, obj.left);
    clone.right = exports.convertPredicateTree(tables, obj.right);
    //console.log("comparison operator - clone");
    clone.printTree("pred");
    return clone;
}

function convertPredicate_OperatorLogical(tables, obj) {
    //console.log("logical operator =", obj.operator);
    let variables = ["A", "B"];
    let pat;
    if (obj.operator == "LEX_KEYWORD_AND") {
	pat = getEvalPattern(variables, obj.left) + " && " + getEvalPattern(variables, obj.right);
    } else if (obj.operator == "LEX_KEYWORD_OR") {
	console.log("convertPredicate_OperatorLogical() LEFT");
	obj.left.printTree();
	console.log("convertPredicate_OperatorLogical() RIGHT");
	obj.right.printTree();
	pat = getEvalPattern(variables, obj.left) + " || " + getEvalPattern(variables, obj.right);
    } else {
	throw("getBooleanPattern() logical op " + obj.printTree());
    }
    let clone = new NODES.Operator_Logical();
    console.log("convertPredicate_OperatorLogical() PAT", pat);
    rewriteLogical(pat, obj, tables, clone);
    return clone;
}


function boolEvaluate(str, A, B, X=false) {
    // hack - avoid parsing str by using eval()
    if (eval(str))
	return 1;
    else
	return 0;
}

function rewriteLogical(pattern, obj, tables, clone) {
    console.log("logical op pattern =", pattern);

    let val_FF = boolEvaluate(pattern, false, false);
    let val_FT = boolEvaluate(pattern, false, true);
    let val_TF = boolEvaluate(pattern, true, false);
    let val_TT = boolEvaluate(pattern, true, true);

    // precalculated equivalences
    // based on Karnaugh map of dynamic truth table
    // To DO Gray Code?
    // Commutation:
    // (A || B) --> (B || A)
    // (A && B) --> (B && A)
    // Distribution:
    // (A && (B || C)) --> ((A && B) || (A && C))
    // (A || (B && C)) --> ((A || B) && (A || C))
    // (A || B) && (C || D) --> (A && C) || B && C) || (A && D) || (B && D)
    // (A && B) ||(C && D) --> (A || C) && (B || C) && (A || D) && (B || D)
    // Tautology & Contradiction
    // (A || !A) --> true
    // (A || true) --> true
    // (A && !A) --> false
    // (A && false) --> false
    // DeMorgan’s Laws:
    // !(A || B) --> !A && !B
    // !(A && B) --> !A || !B    
    const kmap = [
	[ // 0xxx
	    [ // 00xx
		[ /* 000x */ 'false', 'A && B'],
		[ /* 001x */ 'A && !B', 'A'],
	    ],
	    [ // 01xx
		[ /* 010x */ '!A && B', 'B'],
		[ /* 011x */ 'A ^ B', 'A || B'],
	    ],
	],
	[ // 1xxx
	    [ // 10xx
		[ /* 100x */ '!(A || B)', '!A ^ B'],
		[ /* 101x */ '!B', 'A || !B'],
	    ],
	    [ // 11xx
		[ /* 110x */ '!A', '!A || B'],
		[ /* 111x */ '!(A && B)', 'true'],
	    ],
	]
    ];

    let newPat = kmap[val_FF][val_FT][val_TF][val_TT];
    console.log("logical op REWRITE =", newPat);

    if (pattern == newPat) {
	// use current object to fill in clone
	clone.operator = obj.operator;
	clone.left = exports.convertPredicateTree(tables, obj.left);
	clone.right = exports.convertPredicateTree(tables, obj.right);
	//clone.printTree();
    } else {
	//throw("rewriteLogical() TO DO");
	// rewrite tree with new pattern?
	// punt for now, keep old object's structure
	clone.operator = obj.operator;
	clone.left = exports.convertPredicateTree(tables, obj.left);
	clone.right = exports.convertPredicateTree(tables, obj.right);
    }
}

function getEvalPattern(vars, obj) {
    if (obj instanceof NODES.Operator_Comparison) {
	obj.printTree("eval");
	if (vars.length > 0) {
            return vars.shift();
	} else {
	    return "X";
	}
    } else {
	return "X";
    }
}


function convertPredicate_OperatorBetween(tables, obj) {
    //console.log("between operator");
    let clone = new NODES.Operator_Between();
    clone.left = exports.convertPredicateTree(tables, obj.left);
    clone.right = exports.convertPredicateTree(tables, obj.right);
    //clone.printTree();
    return clone;
}

function convertPredicate_OperandArray(tables, obj) {
    console.log("convertPredicate_OperandArray()");
    let clone = new NODES.OperandArray();
    for (let i=0; i<obj.values.length; i++) {
	let op = exports.convertPredicateTree(tables, obj.values[i]);
	clone.values.push(op);
    }

    clone.printTree();
    return clone;
}


function convertPredicate_Operand(tables, obj) {
    if (obj.type == "LEX_IDENTIFIER") {
	let tableMatch = METADATA.checkNameAllTables(tables, obj.value);
	if (tableMatch == null) {
	    // TO DO -- better error message
	    throw("Unknown column '" + obj.value + "' in from-list table(s)");
	} else {
	    //console.log("convertPredicate_Operand() - column =", obj.value);
	    let foundMatch = false;
	    for (let c=0; c<selectContext.columnsRequired.length; c++) {
		// console.log("convertPredicate_Operand() - inPredicate column", selectContext.columnsRequired[c].name);
		if (obj.value == selectContext.columnsRequired[c].name) {
		    foundMatch = true;
		    break;
		}
	    }
	    if (foundMatch != true) {
		//console.log("convertPredicate_Operand() - adding column", obj.value);
		let col = new NODES.InternalColumn();
		col.name = obj.value;
		col.table = tableMatch;
		selectContext.columnsRequired.push(col);
	    }
	}
    }
    // loop over properties to avoid hard-coding them here
    let clone = {};
    for (let i in obj) {
	if (obj.hasOwnProperty(i)) {
            clone[i] = exports.convertPredicateTree(tables, obj[i]);
        } else {
            clone[i] = obj[i];
	}
    }
    return clone;
}
