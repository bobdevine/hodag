"use strict";


const FAKE_META_DATA = [];

//==============================================
exports.metadata_table = function() {
    this.tablename;
    this.rowcount;
    this.columns = [];
    this.indexes = [];
    this.keys = [];
    this.constraints = [];
}

exports.metadata_tableConstraint = function() {
    this.columns = [];
}

exports.metadata_column = function() {
    this.name;
    this.type;
    this.typePrecision;
    this.typeScale;
    this.varying;
    this.typeScale;
    this.constraintNotNull;
    this.constraintUnique;
}

exports.metadata_index = function() {
    this.name;
    this.columns = [];
}

exports.metadata_key = function() {
    this.keyType;
    this.name;
    this.columns = [];
}


//==============================================
exports.init = function() {
    let col;
    let tbl;
    let idx;

    tbl = new exports.metadata_table();
    tbl.tablename = "tt1";
    tbl.rowcount = 1000;
    col = new exports.metadata_column();
    col.name = "aaa";
    col.type = exports.convertType("LEX_NUM_INT");
    tbl.columns.push(col);
    col = new exports.metadata_column();
    col.name = "bbb";
    col.type = exports.convertType("LEX_NUM_INT");
    tbl.columns.push(col);
    col = new exports.metadata_column();
    col.name = "ccc";
    col.type = exports.convertType("LEX_NUM_INT");
    tbl.columns.push(col);
    idx = new exports.metadata_index();
    idx.name = "idx_aaa";
    idx.columns.push("aaa");
    tbl.indexes.push(idx);
    FAKE_META_DATA.push(tbl);

    tbl = new exports.metadata_table();
    tbl.tablename = "tt2";
    tbl.rowcount = 1000;
    col = new exports.metadata_column();
    col.name = "aaa";
    col.type = exports.convertType("LEX_NUM_INT");
    tbl.columns.push(col);
    col = new exports.metadata_column();
    col.name = "ddd";
    col.type = exports.convertType("LEX_NUM_INT");
    tbl.columns.push(col);
    col = new exports.metadata_column();
    col.name = "eee";
    col.type = exports.convertType("LEX_NUM_INT");
    tbl.columns.push(col);
    col = new exports.metadata_column();
    col.name = "fff";
    col.type = exports.convertType("LEX_KEYWORD_CHAR");
    tbl.columns.push(col);
    idx = new exports.metadata_index();
    idx.name = "idx_aaa";
    idx.columns.push("aaa");
    tbl.indexes.push(idx);
    FAKE_META_DATA.push(tbl);
    
    //console.log("METADATA.init() #tables added =", FAKE_META_DATA.length);
}

const DBtypes = Object.freeze({
    // logical
    BOOLEAN : 100,
    // exact numerics
    BIT : 200,
    INT : 201,
    TINYINT : 202,
    BIGINT : 203,
    SMALLINT : 204,
    NUMERIC : 205,
    DECIMAL : 206,
    SMALLMONEY : 207,
    MONEY : 208,
    INTERVAL : 209,
    // approximate numerics
    FLOAT : 300,
    REAL : 301,
    // date and time
    DATE : 400,
    //DATETIMEOFFSET : 401,
    DATETIME : 402,
    //SMALLDATETIME : 403,
    TIME : 404,
    // character strings
    CHAR : 500,
    VARCHAR : 501,
    TEXT : 502,
    // Unicode character strings
    NCHAR : 600,
    NVARCHAR : 601,
    NTEXT : 602,
    // binary strings
    BINARY : 700,
    //VARBINARY : 701,
    //IMAGE : 702,
});


exports.convertType = function(internalName) {
    switch (internalName) {
    case "LEX_KEYWORD_BOOLEAN":
	return DBtypes.BOOLEAN;
    case "LEX_NUM_BIT":
	return DBtypes.BIT;
    case "LEX_NUM_INT":
    case "LEX_KEYWORD_INT":
    case "LEX_KEYWORD_INTEGER":
	return DBtypes.INT;
    case "LEX_KEYWORD_SMALLINT":
	return DBtypes.SMALLINT;
    case "LEX_KEYWORD_BIGINT":
	return DBtypes.BIGINT;
    case "LEX_NUM_FLOAT":
    case "LEX_KEYWORD_FLOAT":
	return DBtypes.FLOAT;
    case "LEX_KEYWORD_CHAR":
	return DBtypes.CHAR;
    case "LEX_KEYWORD_NCHAR":
	return DBtypes.NCHAR;
    case "LEX_KEYWORD_VARCHAR":
	return DBtypes.VARCHAR;
    case "LEX_KEYWORD_NVARCHAR":
	return DBtypes.NVARCHAR;
    case "LEX_KEYWORD_TEXT":
	return DBtypes.TEXT;
    case "LEX_KEYWORD_NTEXT":
	return DBtypes.NTEXT;
    case "LEX_STRING_DQUOTE":
    case "LEX_STRING_SQUOTE":
	return DBtypes.CHAR;
    case "LEX_KEYWORD_NUMERIC":
	return DBtypes.NUMERIC;
    case "LEX_KEYWORD_DECIMAL":
	return DBtypes.DECIMAL;
    case "LEX_KEYWORD_BINARY":
	return DBtypes.BINARY;
    case "LEX_KEYWORD_MONEY":
	return DBtypes.MONEY;
    case "LEX_KEYWORD_SMALLMONEY":
	return DBtypes.SMALLMONEY;
    case "LEX_KEYWORD_DATE":
	return DBtypes.DATE;
    case "LEX_KEYWORD_TIME":
	return DBtypes.TIME;
    case "LEX_KEYWORD_DATETIME":
	return DBtypes.DATETIME;
    default:
	//console.error("convertType() unknown type", internalName);
	throw("convertType() unknown type: '" + internalName + "'");
    }
}


exports.addTable = function(tbl) {
    // TODO - check for valid arg
    // TODO - check for duplicates
    //console.log("addTable() " + JSON.stringify(tbl));
    FAKE_META_DATA.push(tbl);
}


exports.getIndexes = function(tablename, colname) {
    //console.log("getIndexes() tablename =", tablename, "colname", colname);
    if (!tablename) {
	throw("metadata.getIndex() - bad tablename argument");
    }
    const indexes = [];
    for (let m=0; m<FAKE_META_DATA.length; m++) {
	//console.log("getIndexes() metadata =", JSON.stringify(FAKE_META_DATA[m]));
	if (FAKE_META_DATA[m].indexes && (tablename == FAKE_META_DATA[m].tablename)) {
	    for (let i=0; i<FAKE_META_DATA[m].indexes.length; i++) {
		//console.log("getIndexes() index =", JSON.stringify(FAKE_META_DATA[m].indexes[i]));
		if (FAKE_META_DATA[m].indexes[i].columns.indexOf(colname) >= 0) {
		    indexes.push(FAKE_META_DATA[m].indexes[i]);
		}
	    }
	}
    }
    return indexes;
}


exports.getColumns = function(tablename) {
    //console.log("getColumns() tablename=" + tablename);
    if (!tablename) {
	throw("metadata.getColumns() - bad tablename argument");
    }
    let cols = [];
    for (let m=0; m<FAKE_META_DATA.length; m++) {
	if (tablename == FAKE_META_DATA[m].tablename) {
	    for (let c=0; c<FAKE_META_DATA[m].columns.length; c++) {
		cols.push(FAKE_META_DATA[m].columns[c].name);
	    }
	    return cols;
	}
    }
    console.log("metadata.getColumns - tablename", tablename, "not found");
    return [];
}


exports.checkNameOneTable = function(tablename, colname) {
    //console.log("checkNameOneTable() tablename=", tablename + " colname=" + colname);
    if (!tablename) {
	throw("metadata.checkNameOneTable() - bad tablename argument");
    }
    for (let m=0; m<FAKE_META_DATA.length; m++) {
	if (tablename == FAKE_META_DATA[m].tablename) {
	    for (let c=0; c<FAKE_META_DATA[m].columns.length; c++) {
		if (colname == FAKE_META_DATA[m].columns[c].name) {
		    return true;
		}
	    }
	}
    }

    return false;
}

exports.checkNameAllTables = function(tables, colname) {
    //console.log("checkNameAllTables() tables=", tables + " colname=" + colname);
    for (let t=0; t<tables.length; t++) {
	if (exports.checkNameOneTable(tables[t], colname))
	    return tables[t];
    }
    return null;
}

exports.validTablename = function(tablename) {
    //console.log("validTablename() tablename=" + tablename);
    for (let m=0; m<FAKE_META_DATA.length; m++) {
	//console.log("validTablename()", m, JSON.stringify(FAKE_META_DATA[m]));
	if (tablename == FAKE_META_DATA[m].tablename) {
	    //console.log("validTablename() VALID tablename=" + tablename);
	    return true;
	}
    }
    return false;
}
