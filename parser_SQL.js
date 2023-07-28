// make a concrete syntax tree for a SQL statement

const SQL_LEXER = require("./lexer_SQL.js");
const NODES = require("./nodes.js");
const PREDICATE = require("./predicate.js");
const FROM = require("./from.js");
const CREATE = require("./create.js");

// TO DO -- re-write to integrate lexer with parser to incrementally lex?


// state-machine grammar parser with simple backtracking
matchRule = function (cmd, grammar, tokens, gramRule, indexTokens, nodeContextBlock) {
    //console.log("matchRule() pat '" + gramRule + "'");
    if (grammar[gramRule] == undefined) {
	throw("Grammar error -- no rule named '" + gramRule + "'");
    }
    if (grammar[gramRule].production == undefined) {
	throw("Grammar error -- no 'production' for rule named '" + gramRule + "'");
    }
    //for (let t in tokens) { console.log('== matchRule tok=' + tokens[t][0]); }
    let ret = checkPattern(cmd, grammar, tokens, grammar[gramRule], indexTokens, nodeContextBlock);
    // TO DO - error handling for partial success
    //console.log("matchRule() pat = '" + JSON.stringify(grammar[gramRule]) + "' ret = '" + JSON.stringify(ret) + "'");
    if (ret.currentToken > tokens.length) {
	console.log("--- matchRule() no tokens");
	if (ret.status == true) {
	    return ret;
	}
	let e = new Error();
	console.log(e.stack);
	return { "status": false, "currentToken": tokens.length - 1 };
    }
    return ret;
}

var maxTokensMatched = -1;
var maxNode;

function checkPattern(cmd, grammar, tokens, node, indexTokens, nodeContextBlock) {
    //console.log("checkPattern() node '" + JSON.stringify(node) + "'");
    //console.log("checkPattern() nodeContextBlock '" + JSON.stringify(nodeContextBlock) + "'");
    //console.log("checkPattern() node.production = '" + node.production + "' index = " + indexTokens);
    let idx;
    let ret;
    let newNode;
    if (maxTokensMatched < indexTokens) {
	maxTokensMatched = indexTokens;
	maxNode = node;
    }
    switch (node.production) {
    case "ANYOF":
	if (node.choices == undefined) {
	    throw("Grammar error -- missing 'choices' tag");
	}
	if (indexTokens >= tokens.length) {
	    //console.log("checkPattern() ANYOF - no tokens");
	    return {"status":true, "currentToken": indexTokens};
	}
	let choiceName;
	for (let idx=0; idx < node.choices.length; idx++) {
	    choiceName = node.choices[idx];
	    //console.log("checkPattern() ANYOF - trying rule '" + choiceName + "'");
	    //for (let t in tokens) { console.log('   >> (before) tok=' + tokens[t][0]); }
	    //console.log("checkPattern() ANYOF - trying rule '" + choiceName + "' nodeContextBlock = '" + JSON.stringify(nodeContextBlock) + "'");
	    let ret = matchRule(cmd, grammar, tokens, choiceName, indexTokens, nodeContextBlock);
	    //console.log("checkPattern() ANYOF ret = '" + JSON.stringify(ret) + "'");
	    if (ret.status == true) {
		//console.log("checkPattern() ANYOF - matched '" + choiceName + "'");
		return { "status": true, "currentToken": ret.currentToken, "node": nodeContextBlock };
	    }
	    if (ret.currentToken >= tokens.length) {
		//console.log("--- checkPattern() ANYOF no tokens, backtracking");
		continue;
	    }
	}
	if (indexTokens >= tokens.length) {
	    //console.log("checkPattern() ANYOF -- no more tokens");
	    return { "status": true, "currentToken": indexTokens};
	}
	//console.log("checkPattern() ANYOF no match for '" + choiceName + "'");
	return { "status": false, "currentToken": indexTokens};
	
    case "ALLOF":
	//console.log("checkPattern() ALLOF");
	if (node.sequence == undefined) {
	    throw("Grammar error -- ALLOF missing 'sequence' tag");
	}
	if (node.sequence.length == 0) {
	    throw("Grammar error -- ALLOF empty 'sequence' tag");
	}
	let sequenceContext;
        if (node.className != undefined) {
            //console.log("--checkPattern() SEQ new class", node.className);
	    try {
		newNode = new NODES[node.className]();
	    } catch (err) {
		throw("Grammar error -- ALLOF rule; unknown className '" + node.className + "'.  " + err);
            }
            //newNode.printTree();
            sequenceContext = newNode;
        } else {
	    sequenceContext = nodeContextBlock;
	}
	// all subparts of a ALLOF must succeed for rule to be true
	idx = indexTokens;
	for (let i=0; i<node.sequence.length; i++) {
	    let ret = checkPattern(cmd, grammar, tokens, node.sequence[i], idx, sequenceContext);
	    //console.log("checkPattern() ALLOF, ret = '" + JSON.stringify(ret) + "'");
	    if (ret.status == false) {
		return { "status": false, "currentToken": ret.currentToken};
	    }
	    idx = ret.currentToken;
	}
        if (node.className != undefined) {
	    //nodeContextBlock.printTree();
	    //console.log("checkPattern() ALLOF parent nodeContextBlock = '" + JSON.stringify(nodeContextBlock) + "'");
	    //console.log("checkPattern() ALLOF node = '" + JSON.stringify(node) + "'");
	    if (node.parentArrayName != undefined) {
		try {
		    nodeContextBlock[node.parentArrayName].push(newNode);
		} catch (err) {
		    console.log("checkPattern() ALLOF nodeContextBlock = '" + JSON.stringify(nodeContextBlock) + "'");
		    //console.log("checkPattern() ALLOF node = '" + JSON.stringify(node) + "'");
		    throw("Grammar error -- ALLOF bad parentArrayName '" + node.parentArrayName + "' in class '" + node.className + "'.  " + err);
		}
		//console.log("checkPattern() ALLOF after parent array push = '" + JSON.stringify(nodeContextBlock) + "'");
		//nodeContextBlock.printTree();
	    } else {
		throw("Internal error -- ALLOF missing parentArrayName for rule '" + JSON.stringify(node) + "'");
	    }
	}
	//console.log("checkPattern() ALLOF=success sequenceContext = " + JSON.stringify(sequenceContext));
	return { "status": true, "currentToken": idx, "node": sequenceContext};
	
    case "REPEAT":
	//console.log("checkPattern() REPEAT, node = '" + JSON.stringify(node) + "'");
	if (node.content == undefined) {
	    throw("Grammar error -- REPEAT missing 'content' tag");
	}
	if (node.minrepeat == undefined) {
	    throw("Grammar error -- REPEAT missing 'minrepeat' tag");
	}
	if (indexTokens >= tokens.length) {
	    //console.log("checkPattern() REPEAT - no tokens");
	    return {"status":true, "currentToken":indexTokens};
	}
	idx = indexTokens;
	let loopCount = 0;
	while (true) {
	    //console.log("checkPattern() REPEAT, idx = " + idx + " context ='" + JSON.stringify(nodeContextBlock) + "'");
	    //console.log("checkPattern() REPEAT, idx = " + idx + " node.content ='" + JSON.stringify(node.content) + "'");
	    let ret = checkPattern(cmd, grammar, tokens, node.content, idx, nodeContextBlock);
	    //console.log("checkPattern() REPEAT, ret = '" + JSON.stringify(ret) + "'");
	    if (ret.status == true) {
		idx = ret.currentToken;
		loopCount += 1;
		if (node.maxrepeat && loopCount > node.maxrepeat) {
		    let posStart = tokens[idx-1][1];
		    let posEnd = posStart + tokens[idx-1][2];
		    let str = cmd.slice(posStart, posEnd);
		    //console.log("checkPattern() REPEAT -- maxrepeat exceeded");
		    throw("checkPattern() REPEAT -- maxrepeat exceeded for '" + str + "'");
		    //return { "status": false, "currentToken": indexTokens};
		}
		continue;
	    }
	    if (node.minrepeat <= loopCount) {
		// met minimum?
		//console.log("checkPattern() REPEAT before return -- ret.status=false node.minrepeat=" + node.minrepeat);
		return { "status": true, "currentToken": idx, "node": nodeContextBlock};
	    }
	    return { "status": false, "currentToken": indexTokens};
	}
	break;
	
    case "RULE":
	//console.log("checkPattern() RULE '" + node.name + "'");
	ret = matchRule(cmd, grammar, tokens, node.name, indexTokens, nodeContextBlock);
	//console.log("checkPattern() RULE, ret = '" + JSON.stringify(ret) + "'");
	return ret;
	
    case "TERMINAL":
	//console.log("checkPattern() TERMINAL '" + node.name + "'");
	if (indexTokens >= tokens.length) {
	    //console.log("checkPattern() TERMINAL - No tokens");
	    return { "status": false, "currentToken": tokens.length};
	}
	if (tokens[indexTokens][0] != node.name) {
	    //console.log("checkPattern() TERMINAL - MISMATCH. Wanted '" + node.name + "'" + " got '" + tokens[indexTokens][0] + "' at position " + tokens[indexTokens][1]);
	    return { "status": false, "currentToken": indexTokens};
	}
	//console.log("checkPattern() TERMINAL - MATCH '" + node.name + "'");
        if (node.propName != undefined) {
	    //console.log("checkPattern() TERMINAL - propname = '" + node.propName + "'" + " str = '" + str + "'");
	    let posStart = tokens[indexTokens][1];
	    let posEnd = posStart + tokens[indexTokens][2];
	    let str = cmd.slice(posStart, posEnd);
	    //console.log("checkPattern() TERMINAL - str = '" + str + "'");
	    try {
		// use Object.hasOwn() ?
		nodeContextBlock[node.propName] = str;
	    } catch (err) {
		throw("Grammar error -- TERMINAL bad propName '" + node.propName + "' " + err);
	    }
	}
        if (node.propType != undefined) {
	    nodeContextBlock.propType = node.propType;
	}

	//console.log("checkPattern() TERMINAL before return, nodeContextBlock = '" + JSON.stringify(nodeContextBlock) + "'");
	//nodeContextBlock.printTree();

	// advance to next token
	return { "status": true, "currentToken": indexTokens + 1, "node": nodeContextBlock};

    case "FUNCTION":
	try {
	ret = DynamicFunctionCaller[node.name](cmd, tokens, indexTokens, nodeContextBlock);
	} catch (err) {
	    //console.trace();
	    throw("Grammar error -- dynamic function '" + node.name + "' " + err);
	}
	//console.log("PREDICATE currentToken= " + ret.currentToken);
	return { "status": true, "currentToken": ret.currentToken};

    default:
	//console.log("checkPattern() unknown production: '" + node.production + "'");
	//console.log("checkPattern() DEFAULT node '" + JSON.stringify(node) + "'");
	throw("Grammar error -- unknown production: '" + node.production + "'");
    }
}


//----------------------------------------------------------
DynamicFunctionCaller = {};
DynamicFunctionCaller.from_expression = function (cmd, tokens, indexTokens, nodeContext) {
    //console.log("from_expression()");
    let ret = FROM.parse(nodeContext, cmd, tokens, indexTokens);
    //console.log("FROM ret = " + JSON.stringify(ret));
    return { "status": true, "currentToken": ret.index};
}
DynamicFunctionCaller.where_expression = function (cmd, tokens, indexTokens, nodeContext) {
    //console.log("where_expression()");
    let ret = PREDICATE.parse_Where(cmd, tokens, indexTokens);
    //console.log("WHERE = " + JSON.stringify(ret.node));
    nodeContext.wherePredicate = ret.node;
    return { "status": true, "currentToken": ret.index};
}
DynamicFunctionCaller.select_value_expression = function (cmd, tokens, indexTokens, nodeContext) {
    //console.log("select_value_expression()");
    return { "status": false, "currentToken": indexTokens};
}
DynamicFunctionCaller.create_expression = function (cmd, tokens, indexTokens, nodeContext) {
    console.log("create_expression()");
    let ret = CREATE.parse_column_definition(nodeContext, cmd, tokens, indexTokens);
    console.log("CREATE ret = " + JSON.stringify(ret));
    return { "status": true, "currentToken": ret.index};
}


//----------------------------------------------------------
exports.buildErrorMessage = function (cmd, grammar, tokens) {
    //let node = grammar[gramPattern];
    //let errorString = "Syntax error -- Expected ";

    if (maxTokensMatched > tokens.length) maxTokensMatched = tokens.length;

    let errorString = " Matched though '";
    for (let i=0; i<maxTokensMatched; i++) {
	let posStart = tokens[i][1];
	let posEnd = posStart + tokens[i][2];
	let str = cmd.slice(posStart, posEnd);
	//console.log(str);
	if (i > 0) errorString += " ";
	errorString += str;
    }
    errorString += "'";

    //console.log("buildErrorMessage maxNode= " + JSON.stringify(maxNode));
    errorString += " when looking at ";
    switch (maxNode.production) {
    case "ANYOF":
	errorString += "ANY OF: ";
	for (let i=0; i<maxNode.choices.length; i++) {
	    if (i > 0) {
		errorString += ', ';
	    }
	    errorString += maxNode.choices[i];
	}
	break;
    case "ALLOF":
	console.log("buildErrorMessage() ALLOF");
	errorString += "A GRAMMAR SEQUENCE ";
	for (let i=0; i<maxNode.sequence.length; i++) {
	    if (i > 0) {
		errorString += ', ';
	    }
	    errorString += maxNode.sequence[i];
	}
	break;
    case "REPEAT":
	console.log("buildErrorMessage() REPEAT");
	errorString += "a GRAMMAR REPEAT " + JSON.stringify(maxNode);
	break;
    case "RULE":
	//console.log("buildErrorMessage() RULE");
	errorString += "a GRAMMAR RULE " + JSON.stringify(maxNode);
	break;
    case "TERMINAL":
	//console.log("buildErrorMessage() TERMINAL");
	errorString += "a TERMINAL for " + JSON.stringify(maxNode);
	break;
    default:
	console.log("buildErrorMessage() default");
	errorString += "an UNKNOWN GRAMMAR NODE " + JSON.stringify(maxNode);
    }

    return errorString;
}


//=================================================================

exports.parse = function(grammar, cmd) {
    //console.log('parse cmd=' + cmd);
    let lexer = new SQL_LEXER.SQL_Lexer();
    // tokenize all of the input command
    lexer.tokenize(cmd);
    let tokens = lexer.getTokens();
    //for (let t in tokens) { console.log('lexed tok=' + tokens[t][0]);  }
    // create trunk to append a context block
    let ParseContext = new NODES.Trunk();
    //ParseContext.printTree();
    let ret = matchRule(cmd, grammar, tokens, "SQL START", 0, ParseContext);
    if (ret.status == false) {
	//for (let t in tokens) { console.log('lex tok[' + t + ']=' + tokens[t][0]);  }
	let errorString = exports.buildErrorMessage(cmd, grammar, tokens);
	throw(errorString);
    }

    if (ret.currentToken < tokens.length) {
	for (let t in tokens) { console.log('TOKEN: ' + tokens[t][0]); }
	//let errorString = "Syntax error -- Extra tokens (tokens.length=" + tokens.length + " > ret.currentToken=" + ret.currentToken + ")";
	let posStart = tokens[ret.currentToken][1];
	let posEnd = posStart + tokens[ret.currentToken][2];
	let str = cmd.slice(posStart, posEnd);
	let errorString = "Syntax error at token '" + str + "' at position " + posStart;
	console.log('parse() ' + errorString);
	throw(errorString);
    }

    //console.log("parse() Context = '" + JSON.stringify(ParseContext) + "'");
    //console.log("---------AFTER PARSING/BINDING---------------");
    //ParseContext.printTree();
    
    return ParseContext;
};
