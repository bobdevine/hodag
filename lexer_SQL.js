"use strict";

// context-free tokenizing lexer
exports.SQL_Lexer = function() {
    var tokens = [];    
    const rules = [
	{"type": "LEX_WHITESPACE", "pattern": /^\s+/},
	{"type": "LEX_PAREN_OPEN", "pattern": /^\(/},
	{"type": "LEX_PAREN_CLOSE", "pattern": /^\)/},
	{"type": "LEX_BRACE_OPEN", "pattern": /^\{/},
	{"type": "LEX_BRACE_CLOSE", "pattern": /^\}/},
	{"type": "LEX_BRACKET_OPEN", "pattern": /^\[/},
	{"type": "LEX_BRACKET_CLOSE", "pattern": /^\]/},
	{"type": "LEX_PERIOD", "pattern": /^\./},
	{"type": "LEX_COMMA", "pattern": /^,/},
	{"type": "LEX_LESS", "pattern": /^\</},
	{"type": "LEX_LESS_EQUAL", "pattern": /^\<=/},
	{"type": "LEX_GREATER", "pattern": /^\>/},
	{"type": "LEX_GREATER_EQUAL", "pattern": /^\>=/},
	{"type": "LEX_EQUAL", "pattern": /^=/},
	{"type": "LEX_NOT_EQUAL", "pattern": /^\!=/},
	{"type": "LEX_STAR", "pattern": /^\*/},
	{"type": "LEX_PLUS", "pattern": /^\+/},
	{"type": "LEX_MINUS", "pattern": /^\-/},
	{"type": "LEX_NUM_FLOAT", "pattern": /^-?\d+\.\d+/},
	{"type": "LEX_NUM_INT", "pattern": /^-?\d+/},
	{"type": "LEX_COMMENT_BLOCK", "pattern": /^\/\*/, "action": function(token, input, len) {
	    //console.log("action /* : input = '" + input + "'");
	    //console.log("action : i = " + i);
	    token[0] = 'LEX_COMMENT_BLOCK';
	    let matchLength = len;
	    while (len < input.length) {
		let currentChar = input.charAt(i);
		matchLength += 1;
		if (currentChar == '*') {
		    if ((len+1 < input.length) && (input[len+1] == '/')) {
			matchLength += 1;
			break;
		    }
		} else {
		    len += 1;
		}
	    }
	    return matchLength;
	} },
	{"type": "LEX_COMMENT_SINGLE_LINE", "pattern": /^\/\//, "action": function(token, input, len) {
	    //console.log("action // : input = '" + input + "'");
	    //console.log("action : i = " + i);
	    token[0] = 'LEX_COMMENT_SINGLE_LINE';
	    let matchLength = len;
	    while (len < input.length) {
		let currentChar = input.charAt(len);
		matchLength += 1;
		if (currentChar == '\r' || currentChar == '\n') {
		    break;
		} else {
		    len += 1;
		}
	    }
	    return matchLength;
	} },
	{"type": "LEX_DIVIDE", "pattern": /^\//},  // AKA solidus...
	{"type": "LEX_STRING_DQUOTE", "pattern": /^"(?:[^"\\]|\\.)*"/}, // double-quote
	{"type": "LEX_STRING_SQUOTE", "pattern": /^'(?:[^'\\]|\\.)*'/}, // single-quote
	{"type": "LEX_DOTTED_IDENTIFIER", "pattern": /^\w+\.\w+/},
	{"type": "LEX_IDENTIFIER", "pattern": /^\w+/, "action": function(token, input, len) {
	    keyword_lexer(token, input, len);
	    return len;
	} },
	{"type": "LEX_EXTRA_CHARS", "pattern": /^[\s\S]/}, // match remainders
    ];

    this.getTokens = function() {
	return tokens;
    };

    this.getToken = function(indexToken) {
	if (indexToken > tokens.length) {
	    return null;
	}
        return tokens[indexToken];
    };

    this._tokenFind = function(input, i) {
	for (let ruleNumber=0; ruleNumber < rules.length; ruleNumber++) {
	    //console.log("_tokenFind() pattern : '" + this.rules[ruleNumber].pattern + "'");
	    let regex = rules[ruleNumber].pattern;
	    let result = input.slice(i).match(regex);
            if (result !== null) {
		let matchLength = result[0].length;
		//console.log("_tokenFind() match : '" + rules[ruleNumber].type + "' len = " + matchLength + " string '" + input.slice(i, i+matchLength) + "'");
		let token = ['', i, 0];
		if (Object.hasOwn(rules[ruleNumber], 'action')) {
		    matchLength = rules[ruleNumber].action.call(this, token, input.slice(i), result[0].length);
		} else {
		    token[0] = rules[ruleNumber].type;
		}
		//console.log("tokenFind() : matchLength " + matchLength);
		token[2] = matchLength;
		return token;
	    }
	}
    };

    this.tokenize = function(input) {
	//console.log("tokenize() input : '" + input + "'");
        tokens.length = 0;

	for (let i = 0; i < input.length;) {
	    let lexToken = this._tokenFind(input, i);
	    //console.log("tokenize() : matchLength " + lexToken[2]);
	    if (lexToken[2] == 0) {
		break;
	    }
            i += lexToken[2];
	    let token_type = lexToken[0];
	    //console.log("tokenize() : token_type = " + token_type);
	    if (token_type == "LEX_WHITESPACE") continue;
	    if (token_type == "LEX_COMMENT_BLOCK") continue;
	    if (token_type == "LEX_COMMENT_SINGLE_LINE") continue;
	    //console.log("tokenize() : token_type = " + token_type);
            tokens.push(lexToken);
	}

	/***
	for (i=0; i<tokens.length; i++) {
    	    let token = tokens[i];
            var token_text = input.substr(token[1], token[2]);
            console.log("token : ", token_type, token_text);
	}
	***/
    };
}

const SQL_RESERVED_WORDS = [
    // ANSI SQL89
    "ALL", "AND", "ANY", "AS", "ASC", "AUTHORIZATION", "AVG", "BEGIN",
    "BETWEEN", "BY", "CHAR", "CHARACTER", "CHECK", "CLOSE", "COBOL",
    "COMMIT", "CONTINUE", "COUNT", "CREATE", "CURRENT", "CURSOR",
    "DEC", "DECIMAL", "DECLARE", "DEFAULT", "DELETE", "DESC",
    "DISTINCT", "DOUBLE", "END", "ESCAPE", "EXEC", "EXISTS", "FETCH",
    "FLOAT", "FOR", "FOREIGN", "FORTRAN", "FOUND", "FROM", "GO",
    "GOTO", "GRANT", "GROUP", "HAVING", "IN", "INDICATOR", "INSERT",
    "INT", "INTEGER", "INTO", "IS", "KEY", "LANGUAGE", "LIKE", "MAX",
    "MIN", "MODULE", "NOT", "NULL", "NUMERIC", "OF", "ON", "OPEN",
    "OPTION", "OR", "ORDER", "PASCAL", "PLI", "PRECISION", "PRIMARY",
    "PRIVILEGES", "PROCEDURE", "PUBLIC", "REAL", "REFERENCES", "ROLLBACK",
    "SCHEMA", "SECTION", "SELECT", "SET", "SMALLINT", "SOME", "SQL",
    "SQLCODE", "SQLERROR", "SUM", "TABLE", "TO", "UNION", "UNIQUE",
    "UPDATE", "USER", "VALUES", "VIEW", "WHENEVER", "WHERE", "WITH", "WORK",
    // ANSI SQL92
    "ABSOLUTE", "ACTION", "ADD", "ALLOCATE", "ALTER", "ARE",
    "ASSERTION", "AT", "BIT", "BIT_LENGTH", "BOTH", "CASCADE",
    "CASCADED", "CASE", "CAST", "CATALOG", "CHAR_LENGTH",
    "CHARACTER_LENGTH", "COALESCE", "COLLATE", "COLLATION", "COLUMN",
    "CONNECT", "CONNECTION", "CONSTRAINT", "CONSTRAINTS", "CONVERT",
    "CORRESPONDING", "CROSS", "CURRENT_DATE", "CURRENT_TIME",
    "CURRENT_TIMESTAMP", "CURRENT_USER", "DATE", "DAY", "DEALLOATE",
    "DEFERRABLE", "DEFERRED", "DESCRIBE", "DESCRIPTOR", "DIAGNOSTICS",
    "DISCONNECT", "DOMAIN", "DROP", "ELSE", "EXCEPT",
    "EXCEPTION", "EXECUTE", "EXTERNAL", "EXTRACT", "FALSE", "FIRST",
    "FULL", "GET", "GLOBAL", "HOUR", "IDENTITY", "IMMEDIATE",
    "INITIALLY", "INNER", "INPUT", "INSENSITIVE", "INTERSECT",
    "INTERVAL", "ISOLATION", "JOIN", "LAST", "LEADING", "LEFT",
    "LEVEL", "LOCAL", "LOWER", "MATCH", "MINUTE", "MONTH", "NAMES",
    "NATIONAL", "NATURAL", "NCHAR", "NEXT", "NO", "NULLIF",
    "OCTET_LENGTH", "ONLY", "OUTER", "OUTPUT", "OVERLAPS", "PAD",
    "PARTIAL", "POSITION", "PREPARE", "PRESERVE", "PRIOR", "READ",
    "RELATIVE", "RESTRICT", "REVOKE", "RIGHT", "ROWS", "SCROLL",
    "SECOND", "SESSION", "SESSION_USER", "SIZE", "SPACE", "SQLSTATE",
    "SUBSTRING", "SYSTEM_USER", "TEMPORARY", "THEN", "TIME",
    "TIMESTAMP", "TRAILING", "TRANSACTION", "TRANSLATE", "TRANSLATION",
    "TRIM", "TRUE", "UNKNOWN", "UPPER", "USAGE", "USING",
    "VALUE", "VARCHAR", "VARYING", "WHEN", "WRITE", "YEAR", "ZONE",
    // ANSI SQL99
    "ADMIN", "AFTER", "AGGREGATE", "ALIAS", "ARRAY", "BEFORE",
    "BINARY", "BLOB", "BOOLEAN", "BREADTH", "CALL", "CLASS", "CLOB",
    "COMPLETION", "CONDITION", "CONSTRUCTOR", "CUBE",
    "CURRENT_ROLE", "CYCLE", "DATA", "DEPTH", "DEREF", "DESTROY",
    "DESTRUCTOR", "DETERMINISTIC", "DICTIONARY", "DO", "DYNAMIC",
    "EACH", "ELSEIF", "EQUALS", "EVERY", "EXIT", "FREE", "FUNCTION",
    "GENERAL", "GROUPING", "HANDLER", "HOST", "IF", "IGNORE",
    "INITIALIZE", "INOUT", "ITERATE", "LARGE", "LATERAL", "LEAVE",
    "LESS", "LIMIT", "LIST", "LOCALTIME", "LOCALTIMESTAMP", "LOCATOR",
    "LONG", "LOOP", "MAP", "MODIFIES", "MODIFY", "NCLOB", "NEW",
    "NONE", "NUMBER", "OBJECT", "OFF", "OLD", "OPERATION",
    "ORDINALITY", "OUT", "PARAMETER", "PARAMETERS", "PATH", "POSTFIX",
    "PREFIX", "PREORDER", "RAW", "READS", "RECURSIVE", "REDO",
    // common extensions
    "DATETIME",
    "NTEXT",
    "NVARCHAR",
    // common extensions (MS Transact-SQL)
    "BIGINT",
    "TINYINT",
    "MONEY",
    "SMALLMONEY",
    // common extensions (MySQL)
    "MEDIUMINT",
    "TEXT",
    "TINYTEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
];


function keyword_lexer(token, input, len) {
    //console.log('keyword_lex input=' + input);
    let word = '';
    for (let i = 0; i < len; i++) {
	let currentChar = input.charAt(i);
	//console.log('   keyword_lex ch=' + currentChar);
	word += currentChar;
    }
    if (SQL_RESERVED_WORDS.indexOf(word.toUpperCase()) >= 0) {
	token[0] = 'LEX_KEYWORD_' + word.toUpperCase();
    } else {
	token[0] = 'LEX_IDENTIFIER';
    }
    return len;
}
