"use strict";

//const PREDICATE = require("./predicate.js");
const METADATA = require("./metadata.js");


//const SHOW_COLUMNS = false;
const SHOW_COLUMNS = true;


const SortDirection = Object.freeze({
  NONE : 'NONE',
  ASC  : 'ASC',
  DESC : 'DESC',
});

// for variety, do a class instead of a JS prototyped function...
class SupplychainContract {
    /**
     * Create a contracr for each edge in graph of nodes
     * @constructor
     * @param {Object} [parent] - parent of parseNode
     */
    constructor(parent = null) {
	this.minCardinality = 0;
	this.maxCardinality = 0;
	this.orderByChar;
	this.orderByDirection = SortDirection.NONE;
	this.columns = [];         // one or more
	this.supplier = null;
    }
}


//=================================================
// Parser context blocks
//=================================================

exports.Trunk = function() {
    this.children = [];
}
exports.Trunk.prototype.getOperatorName = function() {
    return '[Trunk]';
}
exports.Trunk.prototype.printTree = function(indent = '??') {
    console.log(indent, this.getOperatorName());
    console.log(indent, "  children:");
    for (var i=0; i<this.children.length; i++) {
        this.children[i].printTree(indent + '>');
    }
}

//-------------------------------------------------

/* SELECT col1, col2, ... FROM table_name WHERE condition */
exports.ContextBlock_Select = function() {
    this.columns = [];
    this.wherePredicate = null;
    this.columnsForDisplay = null;
    this.columnsRequired = null;
    this.fromTables = null;
    //this.tablesFound = null;
}
exports.ContextBlock_Select.prototype.getOperatorName = function() {
    return '[ContextBlock_Select]';
}
exports.ContextBlock_Select.prototype.printTree = function(indent) {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        console.log(indent, "--columns--");
        for (var i=0; i<this.columns.length; i++) {
            this.columns[i].printTree(indent + '>');
        }
    }
    if (this.fromTables) {
	console.log(indent, "--FROM TABLES--");
	this.fromTables.printTree(indent + '>');
    }
}


//-------------------------------------------------

exports.ContextBlock_Delete = function() {
    this.tableName;
    this.wherePredicate = null;
}
exports.ContextBlock_Delete.prototype.getOperatorName = function() {
    return '[ContextBlock_Delete]';
}
exports.ContextBlock_Delete.prototype.printTree = function(indent) {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.columns.length; i++) {
            console.log(indent, "  Col OUT " + this.columns[i]);
        }
    }
}

//-------------------------------------------------

exports.ContextBlock_Insert = function() {
    this.columns = [];
}
exports.ContextBlock_Insert.prototype.getOperatorName = function() {
    return '[ContextBlock_Insert]';
}
exports.ContextBlock_Insert.prototype.printTree = function(indent) {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.columns.length; i++) {
            console.log(indent, "  Col OUT " + this.columns[i]);
        }
    }
}

//-------------------------------------------------

exports.ContextBlock_Update = function() {
    this.columns = [];
    this.newValues = [];
}
exports.ContextBlock_Update.prototype.getOperatorName = function() {
    return '[ContextBlock_Update]';
}
exports.ContextBlock_Update.prototype.printTree = function(indent) {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.columns.length; i++) {
            console.log(indent, "  Col OUT " + this.columns[i]);
        }
    }
}

//-------------------------------------------------

exports.ContextBlock_Create = function() {
    this.tablename;
    this.operation;
}
exports.ContextBlock_Create.prototype.getOperatorName = function() {
    return '[ContextBlock_Create]';
}
exports.ContextBlock_Create.prototype.printTree = function(indent) {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.columns.length; i++) {
            console.log(indent, "  Col OUT " + this.columns[i]);
        }
    }
}

//-------------------------------------------------

exports.ContextBlock_Alter = function() {
    this.columns = [];
}
exports.ContextBlock_Alter.prototype.getOperatorName = function() {
    return '[ContextBlock_Alter]';
}
exports.ContextBlock_Alter.prototype.printTree = function(indent) {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.columns.length; i++) {
            console.log(indent, "  Col OUT " + this.columns[i]);
        }
    }
}

//-------------------------------------------------

exports.ContextBlock_Drop = function() {
    this.columns = [];
}
exports.ContextBlock_Drop.prototype.getOperatorName = function() {
    return '[ContextBlock_Drop]';
}
exports.ContextBlock_Drop.prototype.printTree = function(indent) {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.columns.length; i++) {
            console.log(indent, "  Col OUT " + this.columns[i]);
        }
    }
}


//=================================================
// Parser nodes
//=================================================

// class for (externally) displaying a column
// (InternalColumn has lots of other details used for internal optimizations)
exports.DisplayColumn = function() {
    this.tableName = null;
    this.name;
    this.type;
    this.alias;
    this.functionName; // for function
    this.parameters = []; // for function
    this.columns = []; // for subselect
    this.wherePredicate = null; // for subselect
    this.fromTables = null; // for subselect
}
exports.DisplayColumn.prototype.getOperatorName = function() {
    return '[DisplayColumn]';
}
exports.DisplayColumn.prototype.getDisplayName = function() {
    if (this.alias) {
	return this.alias;
    } else if (this.func) {
	return this.func;
    } else {
	return this.name;
    }
}
exports.DisplayColumn.prototype.printTree = function(indent) {
    //console.log("DisplayColumn", JSON.stringify(this));
    let columnAlias = '';
    if (this.alias) {
	columnAlias = " ALIAS: '" + this.alias + "'";
    }
    let displayName;
    if (this.functionName) {
	displayName = "FUNCTION " + this.functionName + "(";
	for (let p=0; p<this.parameters.length; p++) {
	    if (p>0) { displayName += ", ";}
	    if (this.parameters[p].name) {
		displayName += this.parameters[p].name;
	    } else if (this.parameters[p].value) {
		displayName += this.parameters[p].value;
	    } else {
		displayName += "??";
	    }
	}
	displayName += ")";
    } else {
	displayName = this.name;
    }
    if (this.tableName) {
	console.log(indent, this.getOperatorName() + ' ' + this.tableName + '.' + displayName + columnAlias);
    } else {
	console.log(indent, this.getOperatorName() + ' ' + displayName + columnAlias);
    }
}


//-------------------------------------------------------------

exports.DDL_Top = function() {
    this.children = [];
    this.optimizerContracts = [];
    this.optimizerRules = [
	{ rule:	rule_DDL_Top_1, count: 0 },
	{ rule:	rule_DDL_Top_2, count: 0 }
    ];
}
exports.DDL_Top.prototype.getOperatorName = function() {
    return '[DDL_Top]';
}
exports.DDL_Top.prototype.printTree = function(indent = '==') {
    console.log(indent, this.getOperatorName());
    //console.log("  children:");
    for (var i=0; i<this.children.length; i++) {
        this.children[i].printTree(indent + '>');
    }
}
exports.DDL_Top.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (this.optimizerContracts.length != 1) {
	//this.printTree('??> ');
	for (var i=0; i<this.children.length; i++) {
            this.children[i].printTree('<' + i + '> ');
	}
	throw("DDL_Top node - expected 1 contract, got " + this.optimizerContracts.length);
    }
    for (var i=0; i<this.optimizerContracts.length; i++) {
        this.optimizerContracts[i].supplier.printPlan();
    }
}
exports.DDL_Top.prototype.createContracts = function() {
    console.log("DDL_Top.createContracts");
    if (this.children.length != 1) {
	this.printTree('??');
	this.printPlan();
	throw("DDL_Top node - expected 1 child in createContracts(), got " + this.children.length);
    }
    let contract = new SupplychainContract();
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    contract.supplier = this.children[0];
    this.optimizerContracts.push(contract);    
    this.children[0].createContracts();
    this.children[0] = null; // no longer needed, let GC reclaim it
}
exports.DDL_Top.prototype.getContractCost = function() {
    let cost = 0.0;
    cost += this.optimizerContracts[0].supplier.getContractCost();
    return cost;
}
exports.DDL_Top.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("DDL_Top.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent);
    }
    const alternativeContract = [];
    this.optimizerContracts[0].supplier.improveContract(this.optimizerContracts[0], alternativeContract);
}

function rule_DDL_Top_1(self, contractParent) {
    console.log("rule_DDL_Top_1");
}

function rule_DDL_Top_2(self, contractParent) {
    console.log("rule_DDL_Top_2");
}


//-------------------------------------------------

exports.Delete = function() {
    this.children = [];
    this.optimizerContracts = [];
    this.optimizerRules = [
	{ rule:	rule_Delete_1, count: 0 },
	{ rule:	rule_Delete_2, count: 0 }
    ];
}
exports.Delete.prototype.getOperatorName = function() {
    return '[Delete]';
}
exports.Delete.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (this.children.length == 1) {
	this.children[0].printTree(indent + '>');
    } else {
	console.log(indent, this.getOperatorName(), "No children");
    }
}
exports.Delete.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (this.optimizerContracts.length != 1) {
	//this.printTree('??> ');
	for (var i=0; i<this.children.length; i++) {
            this.children[i].printTree('<' + i + '> ');
	}
	throw("Delete node - expected 1 contract, got " + this.optimizerContracts.length);
    }
    for (var i=0; i<this.optimizerContracts.length; i++) {
        this.optimizerContracts[i].supplier.printPlan();
    }
}
exports.Delete.prototype.createContracts = function() {
    console.log("Delete.createContracts");
    if (this.children.length != 1) {
	this.printTree('??');
	this.printPlan();
	throw("Delete node - expected 1 child in createContracts(), got " + this.children.length);
    }
    let contract = new SupplychainContract();
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    contract.supplier = this.children[0];
    this.optimizerContracts.push(contract);    
    this.children[0].createContracts();
    this.children[0] = null; // no longer needed, let GC reclaim it
}
exports.Delete.prototype.getContractCost = function() {
    let cost = 0.0;
    cost += this.optimizerContracts[0].supplier.getContractCost();
    return cost;
}
exports.Delete.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Delete.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent);
    }
    const alternativeContract = [];
    this.optimizerContracts[0].supplier.improveContract(this.optimizerContracts[0], alternativeContract);
}

function rule_Delete_1(self, contractParent) {
    console.log("rule_Delete_1");
}

function rule_Delete_2(self, contractParent) {
    console.log("rule_Delete_2");
}


//-------------------------------------------------

exports.Select_Function = function() {
    this.functionName;
    this.alias;
    this.parameters = [];
}
exports.Select_Function.prototype.getOperatorName = function() {
    return '[Select_Function]';
}
exports.Select_Function.prototype.getDisplayName = function() {
    if (this.alias) {
	return this.alias;
    } else {
	return this.functionName + "()";
    }
}
exports.Select_Function.prototype.printTree = function(indent) {
    let funcAlias = ' (no alias)';
    if (this.alias) {
	funcAlias = ' (' + this.alias + ')';
    }
    console.log(indent, this.getOperatorName() + ' ' + this.functionName + funcAlias);
}

//-------------------------------------------------

exports.Function_Parameter = function() {
    this.name;
    this.value;
}
exports.Function_Parameter.prototype.getOperatorName = function() {
    return '[Function_Parameter]';
}
exports.Function_Parameter.prototype.getDisplayName = function() {
    if (this.name) {
	return this.name;
    } else {
	return "param??";
    }
}
exports.Function_Parameter.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName() + ' ' + this.name);
}

//-------------------------------------------------

exports.RawTable = function() {
    this.name;
    this.alias;
}
exports.RawTable.prototype.getOperatorName = function() {
    return '[RawTable]';
}
exports.RawTable.prototype.printTree = function(indent) {
    let tableAlias = ' (no alias)';
    if (this.alias) {
	tableAlias = ' (' + this.alias + ')';
    }
    console.log(indent, this.getOperatorName() + ' ' + this.name + tableAlias);
}

//-------------------------------------------------

// JavaScript converts internal (64-bit) values to a 32-bit signed number
//   then performs any bitwise operation
//   then converts back to the 64-bit representation
// 0o1 or 0b1
const JOIN_TYPE_NONE = 0;
const JOIN_TYPE_NATURAL = 1 << 1;
const JOIN_TYPE_INNER = 1 << 2;
const JOIN_TYPE_OUTER_LEFT = 1 << 3;
const JOIN_TYPE_OUTER_RIGHT = 1 << 4;
const JOIN_TYPE_OUTER_FULL = 1 << 5;
const JOIN_TYPE_UNION = 1 << 6;
const JOIN_TYPE_CROSS = 1 << 7;

// A CROSSJOIN that does not have a WHERE clause gives the Cartesian product.
// If WHERE clause is used with CROSS JOIN, it functions like an INNER JOIN.

exports.JOIN_TYPE_NONE = JOIN_TYPE_NONE;
exports.JOIN_TYPE_NATURAL = JOIN_TYPE_NATURAL;
exports.JOIN_TYPE_INNER = JOIN_TYPE_INNER;
exports.JOIN_TYPE_OUTER_LEFT = JOIN_TYPE_OUTER_LEFT;
exports.JOIN_TYPE_OUTER_RIGHT = JOIN_TYPE_OUTER_RIGHT;
exports.JOIN_TYPE_OUTER_FULL = JOIN_TYPE_OUTER_FULL;
exports.JOIN_TYPE_UNION = JOIN_TYPE_UNION;
exports.JOIN_TYPE_CROSS = JOIN_TYPE_CROSS;

function joinName(jointype) {
    let str = "";
    if (jointype & JOIN_TYPE_NATURAL) {
	str += "NATURAL ";
    }
    if (jointype & JOIN_TYPE_INNER) {
	str += "INNER";
    } else if (jointype & JOIN_TYPE_OUTER_LEFT) {
	str += "LEFT OUTER";
    } else if (jointype & JOIN_TYPE_OUTER_RIGHT) {
	str += "RIGHT OUTER";
    } else if (jointype & JOIN_TYPE_OUTER_FULL) {
	str += "FULL OUTER";
    } else if (jointype & JOIN_TYPE_UNION) {
	str += "UNION";
    } else if (jointype & JOIN_TYPE_CROSS) {
	str += "CROSS";
    } else {
	str += "???JOIN???";
    }

    return str;
}

exports.RawJoin = function() {
    this.joinType;
    this.left;
    this.right;
    this.onClause = null;
    this.usingClause = null;
}
exports.RawJoin.prototype.getOperatorName = function() {
    return '[RawJoin - "' + joinName(this.joinType) + '"]';
}
exports.RawJoin.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    //console.log(indent, "--LEFT--");
    if (this.left) { this.left.printTree(indent + "[L] "); }
    //console.log(indent, "--RIGHT--");
    if (this.right) { this.right.printTree(indent + "[R] "); }
}

//-------------------------------------------------


exports.Join = function() {
    this.joinType;
    this.predicate = null;
    this.outputColumns = [];
    this.left = null;
    this.right = null;
    this.requiredColumnsLeft = [];
    this.requiredColumnsRight = [];
    this.optimizerContractLeft = null;
    this.optimizerContractRight = null;
    this.optimizerRules = [
	{ rule:	rule_Join_1, count: 0 },
	{ rule:	rule_Join_2, count: 0 }
    ];
}
exports.Join.prototype.getOperatorName = function() {
    return '[Join "' + joinName(this.joinType) + '"]';
}
exports.Join.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (SHOW_COLUMNS) {
        console.log(indent, "--output columns--");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree(indent + '>');
        }
        console.log(indent, "--req'd columns LEFT--");
        for (var i=0; i<this.requiredColumnsLeft.length; i++) {
            this.requiredColumnsLeft[i].printTree(indent + '>');
        }
        console.log(indent, "--req'd columns RIGHT--");
        for (var i=0; i<this.requiredColumnsRight.length; i++) {
            this.requiredColumnsRight[i].printTree(indent + '>');
        }
    }
    if (this.predicate) {
	console.log("Join.printPlan() predicate --", JSON.stringify(this.predicate));
        this.predicate.printTree(" PRED ");
    }

    this.left.printTree(indent + '>');
    this.right.printTree(indent + '>');
}
exports.Join.prototype.createContracts = function() {
    console.log("Join.createContracts");
    let contract = new SupplychainContract();
    contract.supplier = this.left;
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    for (var c=0; c<this.requiredColumnsLeft.length; c++) {
	contract.columns.push(this.requiredColumnsLeft[c]);
    }
    this.optimizerContractLeft = contract;

    contract = new SupplychainContract();
    contract.supplier = this.right;
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    for (var c=0; c<this.requiredColumnsRight.length; c++) {
	contract.columns.push(this.requiredColumnsRight[c]);
    }    
    this.optimizerContractRight = contract;

    this.left.createContracts();
    this.right.createContracts();
}
exports.Join.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Join.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent);
    }
    this.predicate.printTree("JOIN pred");
    const costOld = this.predicate.getContractCost();
    let alternativeContracts = [];
    this.predicate.improveContract(contractParent, alternativeContracts);
    if (alternativeContracts.length > 0) {
	// pick the best alternative
	let costNew = alternativeContracts[0].getContractCost();
	if (costNew < costOld) {
	    this.predicate = alternativeContracts[0];
	}
    }

    alternativeContracts = [];
    this.optimizerContractLeft.supplier.improveContract(contractParent, alternativeContracts);
    this.optimizerContractRight.supplier.improveContract(contractParent, alternativeContracts);
}
exports.Join.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (SHOW_COLUMNS) {
        console.log("----JOIN output columns----");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree('O--');
        }
        console.log("--JOIN required columns (LEFT)--");
        for (var i=0; i<this.requiredColumnsLeft.length; i++) {
            this.requiredColumnsLeft[i].printTree('L--');
        }
        console.log("--JOIN required columns (RIGHT)--");
        for (var i=0; i<this.requiredColumnsRight.length; i++) {
            this.requiredColumnsRight[i].printTree('R--');
        }
    }
    if (this.predicate) {
	//console.trace();
	//console.log("Join.printPlan() predicate --", JSON.stringify(this.predicate));
        this.predicate.printTree(" == ");
    }

    this.optimizerContractLeft.supplier.printPlan();
    this.optimizerContractRight.supplier.printPlan();
}
exports.Join.prototype.getContractCost = function() {
    //console.log("Join.getContractCost()");
    //let cost = Number.POSITIVE_INFINITY;
    let cost = Number.MAX_VALUE;
    return cost;
}

function rule_Join_1(self, contractParent) {
    console.log("rule_Join_1");
    //
}

function rule_Join_2(self, contractParent) {
    console.log("rule_Join_2");
}


//-------------------------------------------------

exports.Operand = function() {
    this.tableName;
    this.name;
    this.type;
    this.value;
}
exports.Operand.prototype.getOperatorName = function() {
    return '[Operand]';
}
exports.Operand.prototype.printTree = function(indent) {
    if (this.type =="SQL_COLUMN_VARIABLE") {
	console.log(indent, this.getOperatorName(), this.type, "TABLE:", this.tableName, "COL NAME", this.name);
    } else {
	console.log(indent, this.getOperatorName(), this.type, this.value);
    }
}
exports.Operand.prototype.improveContract = function(contractParent, suggestedContracts) {
    //console.log("Operand.improveContract");
    // nothing to improve with leaf value?
    return this;
}
exports.Operand.prototype.getType = function() {
    return this.type;
}
exports.Operand.prototype.getValue = function() {
    return this.value;
}

//-------------------------------------------------

exports.OperandArray = function() {
    this.values = [];
}
exports.OperandArray.prototype.getOperatorName = function() {
    return '[OperandArray]';
}
exports.OperandArray.prototype.printTree = function(indent) {
    console.log("OperandArray() values--", JSON.stringify(this.values));
    for (let i=0; i<this.values.length; i++) {
	//this.values[i].printTree();
    }
}
exports.OperandArray.prototype.improveContract = function(contractParent, suggestedContracts) {
    //console.log("OperandArray.improveContract");
    // nothing to improve with leaf values?
    return this;
}
exports.OperandArray.prototype.getType = function() {
    return null;
}
exports.OperandArray.prototype.getValue = function() {
    return null;
}

//-------------------------------------------------

exports.Operator_Logical = function() {
    this.operator;
    this.left;
    this.right;
}
exports.Operator_Logical.prototype.getOperatorName = function() {
    return '[Operator_Logical]';
}
exports.Operator_Logical.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName() + ' ' + this.operator);
    this.left.printTree(indent + '>');
    this.right.printTree(indent + '>');
}
exports.Operator_Logical.prototype.getValue = function() {
    return undefined;
}
exports.Operator_Logical.prototype.improveContract = function(contractParent, suggestedContracts) {
    //console.log("Operator_Logical.improveContract");
    this.left = this.left.improveContract();
    this.right = this.right.improveContract();

    //console.log("Operator_Logical.improveContract()");
    //this.printTree(indent + '>');

    const valLeft = this.left.getValue();
    //console.log("Operator_Logical.improveContract() RIGHT--", JSON.stringify(this.right));
    //this.right.printTree(indent + '>');
    const valRight = this.right.getValue();

    // convert from SQL operator to Javascript operator
    if (this.operator == "LEX_KEYWORD_AND") {
	//console.log("Operator_Logical.improveContract - AND");
	if (valLeft == false) {
	    return this.left;
	} else if (valRight == false) {
	    return this.right;
	}
	return this;
    } else if (this.operator == "LEX_KEYWORD_OR") {
	//console.log("Operator_Logical.improveContract - OR");
	if (valLeft == true) {
	    console.log("Operator_Logical.improveContract - OR - left=true returning", valRight);
	    return this.right;
	} else if (valRight == true) {
	    console.log("Operator_Logical.improveContract - OR -right=true returning", valLeft);
	    return this.left;
	}
	return this;
    } else {
	console.log("Operator_Logical.improveContract op=", this.operator);
    }
    return null;
}

//-------------------------------------------------

exports.Operator_Logical_Not = function() {
    this.child;
}
exports.Operator_Logical_Not.prototype.getOperatorName = function() {
    return '[Operator_Logical_Not]';
}
exports.Operator_Logical_Not.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    this.child.printTree(indent + '>');
}
exports.Operator_Logical_Not.prototype.improveContract = function(contractParent, suggestedContracts) {
    // A === !!A
    console.log("Operator_Logical_Not.improveContract");
    const alternativeContract = [];
    this.child.improveContract();
}


//-------------------------------------------------

exports.Operator_Comparison = function() {
    this.operator;
    this.left;
    this.right;
}
exports.Operator_Comparison.prototype.getOperatorName = function() {
    return '[Operator_Comparison]';
}
exports.Operator_Comparison.prototype.printTree = function(indent) {
    //console.log("Operator_Comparison.printTree() --", JSON.stringify(this));
    console.log(indent, this.getOperatorName() + ' ' + this.operator);
    if (!this.left) {
	console.log("Operator_Comparison.printTree() --", JSON.stringify(this));
	//console.trace();
    }
    this.left.printTree(indent + ' >');
    if (!this.right) {
	console.log("Operator_Comparison.printTree() --", JSON.stringify(this));
	//console.trace();
    }
    this.right.printTree(indent + ' >');
}
exports.Operator_Comparison.prototype.improveContract = function(contractParent, suggestedContracts) {
    //console.log("Operator_Comparison.improveContract()", this.operator);
    //console.log("Operator_Comparison.improveContract() --", JSON.stringify(this));
    /****
    //this.printTree(indent + '>');    
    console.log("Operator_Comparison.improveContract() LEFT");
    this.left.printTree(indent + '>');

    console.log("Operator_Comparison.improveContract() RIGHT");
    this.right.printTree(indent + '>');
    ***/

    //console.log("Operator_Comparison.improveContract() --", JSON.stringify(this));
    //this.left.printTree('L >');
    //this.right.printTree('R >');

    // depth-first improvement
    const alternativeContracts = [];
    this.left = this.left.improveContract(contractParent, alternativeContracts);
    this.right = this.right.improveContract(contractParent, alternativeContracts);

    const valComparison = this.getValue();
    // use strict === compare, not truthy ==
    if ( (valComparison === true) || (valComparison === false) ) {
	// comparison is constant, switch to simple Boolean operator
	const boolOp = new exports.Operator_Boolean();
	boolOp.value = valComparison;
	suggestedContracts.push(boolOp);
    } else {
	// comparison requires run-time evaluation, don't suggest alternative
    }
}
exports.Operator_Comparison.prototype.getContractCost = function() {
    // TODO - calculate real
    return 5;
}
exports.Operator_Comparison.prototype.getValue = function() {
    //console.log("Operator_Comparison.getValue() --", JSON.stringify(this));
    // convert from lexer's operator to Javascript operator
    let op;
    if (this.operator == "LEX_EQUAL") {
	op = '==';
    } else if (this.operator == "LEX_NOT_EQUAL") {
	op = '!=';
    } else if (this.operator == "LEX_LESS") {
	op = '<';
    } else if (this.operator == "LEX_LESS_EQUAL") {
	op = '<=';
    } else if (this.operator == "LEX_GREATER") {
	op = '>';
    } else if (this.operator == "LEX_GREATER_EQUAL") {
	op = '>=';
    } else if (this.operator == "LEX_KEYWORD_IN") {
	op = 'IN';
    } else {
	console.log("Operator_Comparison.getValue() -- unknown operator " + this.operator);
	op = '?';
    }

    //this.printTree('Op_Comp >');
    //this.left.printTree('Op_Comp L >');
    //this.right.printTree('Op_Comp R >');

    const typeLeft = this.left.getType();
    const valLeft = this.left.getValue();

    const typeRight = this.right.getType();
    const valRight = this.right.getValue();

    let str;
    let result;
    if (typeLeft == "SQL_NUM_INT") {
	switch (typeRight) {
	case "SQL_NUM_INT":
	case "SQL_NUM_FLOAT":
	    str = "" + valLeft + op + valRight;
	    // use new Function() instead of eval() ?
	    result = eval(str);
	    console.log("Operator_Comparison.improveContract - INT : '" + str + "'", result);
	    return result;
	case "SQL_COLUMN_VARIABLE":
	    // need to dynamically evaluate
	    return undefined;
	default:
	    throw("syntax error: incomparable types (" + typeLeft + " and " + typeRight + ") in predicate");
	}
    } else if (typeLeft == "SQL_NUM_FLOAT") {
	switch (typeRight) {
	case "SQL_NUM_INT":
	case "SQL_NUM_FLOAT":
	    str = "" + valLeft + op + valRight;
	    result = eval(str);
	    console.log("Operator_Comparison.improveContract - FLOAT : '" + str + "'", result);
	    return result;
	case "SQL_COLUMN_VARIABLE":
	    // need to evaluate at execution time
	    return undefined;
	default:
	    throw("syntax error: incomparable types (FLOAT and " + typeRight + ") in predicate");
	}
    } else if (typeLeft == "SQL_STRING") {
	switch (typeRight) {
	case "SQL_STRING":
	    str = "" + valLeft + op + valRight;
	    result = eval(str);
	    console.log("Operator_Comparison.improveContract - STRING : '" + str + "'", result);
	    return result;
	case "SQL_COLUMN_VARIABLE":
	    // need to dynamically evaluate
	    return undefined;
	default:
	    throw("syntax error: incomparable types (STRING and " + typeRight + ") in predicate");
	}
    } else if (typeLeft == "SQL_COLUMN_VARIABLE") {
	// need to dynamically evaluate
	return undefined;
    } else {
	throw("syntax error: incomparable types (" + typeLeft + " and " + typeRight + ") in predicate");
    }
}
exports.Operator_Comparison.prototype.getType = function() {
    return "Boolean";
}


//-------------------------------------------------

exports.Operator_Math = function() {
    this.operator;
    this.left;
    this.right;
}
exports.Operator_Math.prototype.getOperatorName = function() {
    return '[Operator_Math] ' + this.operator;
}
exports.Operator_Math.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    this.left.printTree(indent + '>');
    this.right.printTree(indent + '>');
}
exports.Operator_Math.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Operaator_Math.improveContract");
    const alternativeContract = [];
    this.left = this.left.improveContract(contractParent, alternativeContract);
    this.right = this.right.improveContract(contractParent, alternativeContract);
    // Fold expressions:
    //    Binary expressions: 1000 * 60 * 60 → 36e6
    //    Math expressions: Math.sin(Math.Pi / 2 ) → 1
}


//-------------------------------------------------

exports.Operator_Between = function() {
    this.left;
    this.right;
}
exports.Operator_Between.prototype.getOperatorName = function() {
    return '[Operator_Between]';
}
exports.Operator_Between.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    this.left.printTree(indent + '>');
    this.right.printTree(indent + '>');
}
exports.Operator_Between.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Operaator_Between.improveContract");
    const alternativeContract = [];
    this.left = this.left.improveContract(contractParent, alternativeContract);
    this.right = this.right.improveContract(contractParent, alternativeContract);
}


//-------------------------------------------------

exports.Operator_In = function() {
    this.left;
    this.right;
}
exports.Operator_In.prototype.getOperatorName = function() {
    return '[Operator_In]';
}
exports.Operator_In.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    this.left.printTree(indent + '>');
    this.right.printTree(indent + '>');
}
exports.Operator_In.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Operaator_In.improveContract");
    const alternativeContract = [];
    this.left = this.left.improveContract(contractParent, alternativeContract);
    this.right = this.right.improveContract(contractParent, alternativeContract);
}


//-------------------------------------------------

exports.Operator_Boolean = function() {
    this.value;
}
exports.Operator_Boolean.prototype.getOperatorName = function() {
    return '[Operator_Boolean]';
}
exports.Operator_Boolean.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName() + ' ' + this.value);
}
exports.Operator_Boolean.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Operaator_Boolean.improveContract");
}
exports.Operator_Boolean.prototype.getValue = function() {
    return this.value;
}
exports.Operator_Boolean.prototype.getType = function() {
    return "Boolean";
}


//=================================================
// Optimizable nodes
//=================================================

exports.Create = function() {
    this.newTable;
}
exports.Create.prototype.getOperatorName = function() {
    return '[Create]';
}
exports.Create.prototype.printTree = function(indent = '==') {
    console.log(indent, this.getOperatorName());
}
exports.Create.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
}
exports.Create.prototype.createContracts = function() {
    console.log("Create.createContracts");
}
exports.Create.prototype.getContractCost = function() {
    let cost = 0.0;
    return cost;
}
exports.Create.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Create.improveContract");
}

//-------------------------------------------------------------

exports.Display = function() {
    this.outputColumns = [];
    this.requiredColumns = [];
    this.children = [];
    this.optimizerContracts = [];
    this.optimizerRules = [
	{ rule:	rule_Display_1, count: 0 },
	{ rule:	rule_Display_2, count: 0 }
    ];
}
exports.Display.prototype.getOperatorName = function() {
    return '[Display]';
}
exports.Display.prototype.printTree = function(indent = '==') {
    console.log(indent, this.getOperatorName());
    if (SHOW_COLUMNS) {
        console.log(indent, "--Display output columns--");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree(indent + '>');
        }
        console.log(indent, "--Display required columns--");
        for (var i=0; i<this.requiredColumns.length; i++) {
            this.requiredColumns[i].printTree(indent + '>');
        }
    }
    //console.log("  children:");
    for (var i=0; i<this.children.length; i++) {
        this.children[i].printTree(indent + '>');
    }
}
exports.Display.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (SHOW_COLUMNS) {
        console.log("--Display output columns--");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree('>>');
        }
        console.log("--Display required columns--");
        for (var i=0; i<this.requiredColumns.length; i++) {
            this.requiredColumns[i].printTree("<<");
        }
    }
    if (this.optimizerContracts.length != 1) {
	//this.printTree('??> ');
	for (var i=0; i<this.children.length; i++) {
            this.children[i].printTree('<' + i + '> ');
	}
	throw("Display node - expected 1 contract, got " + this.optimizerContracts.length);
    }
    for (var i=0; i<this.optimizerContracts.length; i++) {
        this.optimizerContracts[i].supplier.printPlan();
    }
}
exports.Display.prototype.createContracts = function() {
    console.log("Display.createContracts");
    if (this.children.length != 1) {
	this.printTree('??');
	this.printPlan();
	throw("Display node - expected 1 child in createContracts(), got " + this.children.length);
    }
    let contract = new SupplychainContract();
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    for (var i=0; i<this.requiredColumns.length; i++) {
	contract.columns.push(this.requiredColumns[i]);
    }
    contract.supplier = this.children[0];
    this.optimizerContracts.push(contract);    
    this.children[0].createContracts();
    this.children[0] = null; // no longer needed, let GC reclaim it
}
exports.Display.prototype.getContractCost = function() {
    let cost = 0.0;
    cost += this.optimizerContracts[0].supplier.getContractCost();
    return cost;
}
exports.Display.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Display.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent);
    }
    const alternativeContract = [];
    this.optimizerContracts[0].supplier.improveContract(this.optimizerContracts[0], alternativeContract);
}

function rule_Display_1(self, contractParent) {
    console.log("rule_Display_1");
}

function rule_Display_2(self, contractParent) {
    console.log("rule_Display_2");
}


//-------------------------------------------------

exports.Distinct = function() {
    this.outputColumns = [];
    this.requiredColumns = [];
    this.children = [];
    this.optimizerContracts = [];
    this.optimizerRules = [
	{ rule:	rule_Distinct_1, count: 0 },
	{ rule:	rule_Distinct_2, count: 0 }
    ];
}
exports.Distinct.prototype.getOperatorName = function() {
    return '[Distinct]';
}
exports.Distinct.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (this.children.length == 1) {
	this.children[0].printTree(indent + '>');
    } else {
	console.log(indent, this.getOperatorName(), "No children");
    }
}
exports.Distinct.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (this.optimizerContracts.length != 1) {
	//this.printTree('??> ');
	for (var i=0; i<this.children.length; i++) {
            this.children[i].printTree('<' + i + '> ');
	}
	throw("Distinct node - expected 1 contract, got " + this.optimizerContracts.length);
    }
    for (var i=0; i<this.optimizerContracts.length; i++) {
        this.optimizerContracts[i].supplier.printPlan();
    }
}
exports.Distinct.prototype.createContracts = function() {
    console.log("Distinct.createContracts");
    if (this.children.length != 1) {
	this.printTree('??');
	this.printPlan();
	throw("Distinct node - expected 1 child in createContracts(), got " + this.children.length);
    }
    let contract = new SupplychainContract();
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    contract.supplier = this.children[0];
    this.optimizerContracts.push(contract);    
    this.children[0].createContracts();
    this.children[0] = null; // no longer needed, let GC reclaim it
}
exports.Distinct.prototype.getContractCost = function() {
    let cost = 0.0;
    cost += this.optimizerContracts[0].supplier.getContractCost();
    return cost;
}
exports.Distinct.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Distinct.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent);
    }
    const alternativeContract = [];
    this.optimizerContracts[0].supplier.improveContract(this.optimizerContracts[0], alternativeContract);
}

function rule_Distinct_1(self, contractParent) {
    console.log("rule_Distinct_1");
}

function rule_Distinct_2(self, contractParent) {
    console.log("rule_Distinct_2");
}


//-------------------------------------------------

exports.TableScan = function() {
    this.outputColumns = [];
    this.databaseName = '';
    this.schemaName = '';
    this.tableName = '';
    this.optimizerRules = [
	{ rule:	rule_TableScan_1, count: 0 },
	{ rule:	rule_TableScan_2, count: 0 }
    ];
}
exports.TableScan.prototype.getOperatorName = function() {
    return '[TableScan"]';
}
exports.TableScan.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (SHOW_COLUMNS) {
        console.log(indent, "--TABLE-SCAN output columns--");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree(indent + '>');
        }
    }
}
exports.TableScan.prototype.createContracts = function() {
    console.log("TableScan.createContracts");
    // no contract needed because there are no children
}
exports.TableScan.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("TableScan.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent, suggestedContracts);
    }
}
exports.TableScan.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN", "DB:", this.databaseName, "TABLE:", this.tableName);
    if (SHOW_COLUMNS) {
        console.log("--TABLE-SCAN PLAN output columns--");
	for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree('>>');
	}
    }
}
exports.TableScan.prototype.getContractCost = function() {
    //console.log("TableScan.getContractCost()");
    let cost = 123.0;
    return cost;
}

function rule_TableScan_1(self, contractParent, suggestedContracts) {
    console.log("rule_TableScan_1");    
    //console.log(JSON.stringify(self));
    //contractParent.supplier.printTree("Project supplier");
    //console.log("CONTRACT ", JSON.stringify(contractParent));
    //console.log("++ ", JSON.stringify(contractParent.supplier.outputColumns));
    const colReqLen = contractParent.columns.length;
    const colsChildOutLen = contractParent.supplier.outputColumns.length;
    //console.log("Parent - REQ cols =", colReqLen);
    //console.log("Parent - child cols OUT", colsChildOutLen);
    if (colReqLen < colsChildOutLen && colReqLen==1) {
	//console.log("TableScan cols", JSON.contractParent.columns));
	// offer an alternative contract
	let tablename = contractParent.columns[0].tableName;
	let colname = contractParent.columns[0].name;
	if (!tablename) {
	    throw("rule_TableScan_1() missing tablename");
	}
	if (!colname) {
	    throw("rule_TableScan_1() missing column name");
	}
	let indexes = null;
	indexes = METADATA.getIndexes(tablename, colname);
	//console.log("TableScan indexes", JSON.stringify(indexes));
	if (indexes.length > 0) {
	    let contract = new SupplychainContract();
	    contract.minCardinality = 0;
	    contract.maxCardinality = Number.MAX_VALUE;
	    contract.columns.push(contractParent.supplier.outputColumns[0]);
	    let indexNode = new exports.IndexRead();
	    let col = new exports.InternalColumn();
	    col.name = colname;
	    col.tableName = tablename;
	    indexNode.outputColumns.push(col);
	    contract.supplier = indexNode;
	    suggestedContracts.push(contract);
	}
    }
}

function rule_TableScan_2(self, contractParent, suggestedContracts) {
    console.log("rule_TableScan_2");
}


//-------------------------------------------------

exports.TableRowDelete = function() {
    this.databaseName = '';
    this.schemaName = '';
    this.tableName = '';
    this.predicate;
    this.optimizerRules = [
	{ rule:	rule_TableRowDelete_1, count: 0 },
	{ rule:	rule_TableRowDelete_2, count: 0 }
    ];
}
exports.TableRowDelete.prototype.getOperatorName = function() {
    return '[TableRowDelete"]';
}
exports.TableRowDelete.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (this.predicate) {
	console.log("TableRowDelete.printTree() predicate --", JSON.stringify(this.predicate));
        this.predicate.printTree(" PRED ");
    }
}
exports.TableRowDelete.prototype.createContracts = function() {
    console.log("TableRowDelete.createContracts");
    // no contract needed because there are no children
}
exports.TableRowDelete.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("TableRowDelete.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent, suggestedContracts);
    }
}
exports.TableRowDelete.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN", "DB:", this.databaseName, "TABLE:", this.tableName);
    if (this.predicate) {
	//console.log("TableRowDelete.printPlan() predicate --", JSON.stringify(this.predicate));
        this.predicate.printTree(" PRED ");
    }
}
exports.TableRowDelete.prototype.getContractCost = function() {
    //console.log("TableRowDelete.getContractCost()");
    let cost = 123.0;
    return cost;
}

function rule_TableRowDelete_1(self, contractParent, suggestedContracts) {
    console.log("rule_TableRowDelete_1");
}

function rule_TableRowDelete_2(self, contractParent, suggestedContracts) {
    console.log("rule_TableRowDelete_2");
}


//-------------------------------------------------

exports.EmptyTable = function() {
    this.outputColumns = []; // filled in during optimization
    // no contracts
}
exports.EmptyTable.prototype.getOperatorName = function() {
    return '[EmptyTable]';
}
exports.EmptyTable.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (SHOW_COLUMNS) {
	if (this.outputColumns.length == 0) {
            console.log(indent, "--output columns--");
	}
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree(indent + '>');
        }
    }
}
exports.EmptyTable.prototype.createContracts = function() {
    console.log("EmptyTable.createContracts");
}
exports.EmptyTable.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("EmptyTable.improveContract");
}
exports.EmptyTable.prototype.getContractCost = function() {
    console.log("EmptyTable.getContractCost()");
    let cost = 0.0;
    return cost;
}
exports.EmptyTable.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (SHOW_COLUMNS) {
	if (this.outputColumns.length == 0) {
            console.log("--output columns PLAN--");
	}
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree('>');
        }
    }
}

//-------------------------------------------------

exports.IndexRead = function() {
    this.outputColumns = []; // filled from metadata
    // no contracts
}
exports.IndexRead.prototype.getOperatorName = function() {
    return '[IndexRead]';
}
exports.IndexRead.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (SHOW_COLUMNS) {
	if (this.columns.length == 0) {
            console.log(indent, "--columns--");
	}
        for (var i=0; i<this.columns.length; i++) {
            this.columns[i].printTree(indent + '>');
        }
    }
}
exports.IndexRead.prototype.createContracts = function() {
    console.log("IndexRead.createContracts");
}
exports.IndexRead.prototype.getContractCost = function() {
    //console.log("IndexRead.getContractCost()");
    // TODO - get real index cost
    let cost = 11.0;
    return cost;
}
exports.IndexRead.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("IndexRead.improveContract");
}
exports.IndexRead.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (SHOW_COLUMNS) {
	if (this.outputColumns.length == 0) {
            console.log("--output columns PLAN--");
	}
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree('>');
        }
    }
}

//-------------------------------------------------

exports.Project = function() {
    this.outputColumns = [];
    this.requiredColumns = [];
    this.children = [];
    this.optimizerContracts = [];
    this.optimizerRules = [
	{ rule:	rule_Project_1, count: 0 },
	{ rule:	rule_Project_2, count: 0 }
    ];
}
exports.Project.prototype.getOperatorName = function() {
    return '[Project]';
}
exports.Project.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
}
exports.Project.prototype.createContracts = function() {
    console.log("Project.createContracts");
    if (this.children.length != 1) {
	this.printTree('??');
	this.printPlan();
	throw("PROJECT - expected 1 child in createContracts(), got " + this.children.length);
    }
    let contract = new SupplychainContract();
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    for (var i=0; i<this.requiredColumns.length; i++) {
	contract.columns.push(this.requiredColumns[i]);
    }
    //this.children[0].printTree("Project child");
    contract.supplier = this.children[0];
    this.optimizerContracts.push(contract);
    
    this.children[0].createContracts();
    this.children[0] = null; // no longer needed
}
exports.Project.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("Project.improveContract");
    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent);
    }

    const alternativeContract = [];
    const costOld = this.optimizerContracts[0].supplier.getContractCost();
    //console.log(JSON.stringify(this.optimizerContracts[0]));
    //console.log("PROJECT old cost =", costOld);
    this.optimizerContracts[0].supplier.improveContract(this.optimizerContracts[0], alternativeContract);
    //console.log("Project alt", JSON.stringify(alternativeContract));
    if (alternativeContract.length > 0) {
	// pick the best alternative
	const costNew = alternativeContract[0].supplier.getContractCost();
	//console.log("ALT contract", JSON.stringify(alternativeContract[0]));
	//console.log("PROJECT +new+ cost =", costNew);
	if (costNew < costOld) {
	    this.optimizerContracts[0] = alternativeContract[0];
	}
    }
}
exports.Project.prototype.getContractCost = function() {
    //console.log("Project.getContractCost()");
    let cost = 0.0;
    cost += this.optimizerContracts[0].supplier.getContractCost();
    return cost;
}
exports.Project.prototype.printPlan = function() {
    console.log(this.getOperatorName(), "PLAN");
    if (SHOW_COLUMNS) {
	console.log("-- PROJECT PLAN output columns--");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree(">>");
        }
        console.log("-- PROJECT PLAN required columns--");
        for (var i=0; i<this.requiredColumns.length; i++) {
            this.requiredColumns[i].printTree("<<");
        }
    }
    this.optimizerContracts[0].supplier.printPlan();
}
function rule_Project_1(self, contractParent) {
    console.log("rule_Project_1");
}
function rule_Project_2(self, contractParent) {
    console.log("rule_Project_2");
}

//-------------------------------------------------

exports.Filter = function() {
    this.outputColumns = [];
    this.requiredColumns = [];
    this.predicate = null;
    this.children = [];
    this.optimizerContracts = [];
    this.optimizerRules = [
	{ rule:	rule_Filter_split_predicate, count: 0 },
	{ rule:	rule_Filter_eliminate_filter, count: 0 }
    ];
}
exports.Filter.prototype.getOperatorName = function() {
    return '[Filter]';
}
exports.Filter.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName());
    if (SHOW_COLUMNS) {
        console.log(indent, "-- FILTER output columns--");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printTree(indent + '>');
        }
        console.log(indent, "-- FILTER required columns--");
        for (var i=0; i<this.requiredColumns.length; i++) {
            this.requiredColumns[i].printTree(indent + '>');
        }
    }
    this.predicate.printTree(indent + '[filter]');
    for (var i=0; i<this.children.length; i++) {
        this.children[i].printTree(indent + '>');
    }
}
exports.Filter.prototype.createContracts = function() {
    //console.log("Filter.createContracts");
    //console.log("Filter.createContracts", JSON.stringify(this.predicate));
    //this.predicate.printTree(indent + '>');
    if (this.children.length != 1) {
	throw("Filter node does not have 1 child");
    }
    let contract = new SupplychainContract();
    contract.minCardinality = 0;
    contract.maxCardinality = Number.MAX_VALUE;
    for (var i=0; i<this.requiredColumns.length; i++) {
	contract.columns.push(this.requiredColumns[i]);
    }
    this.children[0].createContracts();
    contract.supplier = this.children[0];
    this.optimizerContracts.push(contract);
    //this.children[0] = null; // no longer needed, let GC free it
}
exports.Filter.prototype.improveContract = function(contractParent, suggestedContracts) {
    //console.log("Filter.improveContract");
    //console.log("Filter.improveContract", JSON.stringify(this.predicate));
    //console.trace();
    this.predicate.printTree('Filter pred >');
    let alternativeContracts = [];
    this.predicate.improveContract(contractParent, alternativeContracts);

    for (let i=0; i<this.optimizerRules.length; i++) {
        this.optimizerRules[i].rule(this, contractParent);
    }

    const alternativeContract = [];
    for (var i=0; i<this.optimizerContracts.length; i++) {
        this.optimizerContracts[i].supplier.improveContract(this.optimizerContracts[0], alternativeContract);
	if (alternativeContract.length > 0) {
	    console.log("Filter.improveContract ALT", JSON.stringify(alternativeContract));
	}
    }
}
exports.Filter.prototype.getContractCost = function() {
    //console.log("Filter.getContractCost()");
    let cost = 0.0;
    cost += this.optimizerContracts[0].supplier.getContractCost();
    return cost;
}
exports.Filter.prototype.printPlan = function() {
    //console.log("Filter.printPlan()");
    console.log(this.getOperatorName(), "PLAN");
    if (SHOW_COLUMNS) {
        console.log("-- FILTER PLAN output columns--");
        for (var i=0; i<this.outputColumns.length; i++) {
            this.outputColumns[i].printPlan();
        }
        console.log("-- FILTER PLAN required columns--");
        for (var i=0; i<this.requiredColumns.length; i++) {
            this.requiredColumns[i].printPlan();
        }
    }
    if (this.predicate) {
	//console.log("Filter.printPlan pred", JSON.stringify(this.predicate));
	this.predicate.printTree('>');
    }
    this.optimizerContracts[0].supplier.printPlan();
}

function rule_Filter_split_predicate(self, contractParent) {
    //console.log("rule_Filter_split_predicate");
    if (self.predicate instanceof exports.Operator_Logical) {
	//console.log("rule_Filter_split_predicate - Operator_Logical");
	if (self.predicate.operator == "LEX_KEYWORD_OR") {
	    if (self.predicate.left instanceof exports.Operator_Boolean) {
		//console.log("rule_Filter_split_predicate - left Bool");
		if (self.predicate.left.getValue() == false) {
		    //console.log("rule_Filter_split_predicate - left Bool false");
		    self.predicate = self.predicate.right;
		}
	    }
	    if (self.predicate.right instanceof exports.Operator_Boolean) {
		//console.log("rule_Filter_split_predicate - right Bool");
		if (self.predicate.right.getValue() == false) {
		    console.log("rule_Filter_split_predicate - right Bool false");
		    self.predicate = self.predicate.left;
		}
	    }
	}
    }
}

function rule_Filter_eliminate_filter(self, contractParent) {
    //console.log("rule_Filter_eliminate_filter");
    if (self.predicate instanceof exports.Operator_Boolean) {
	console.log("rule_Filter_split_predicate - Operator_Boolean");
	if (self.predicate.value == false) {
	    console.log("rule_Filter_split_predicate - Operator_Boolean FALSE");
	    let tbl = new exports.EmptyTable();
	    for (var i=0; i<self.outputColumns.length; i++) {
		//this.outputColumns[i].printTree(indent + '>');
		tbl.outputColumns.push(self.outputColumns[i]);
	    }
	    contract.supplier = tbl;
	}
    }
}


//-------------------------------------------------

exports.InternalColumn = function() {
    this.name;
    this.tableName;  // to disambiguate names
    this.type;
    this.hasDuplicates;
    this.minCardinality = 0;
    this.maxCardinality = 0;
    this.orderByDirection = SortDirection.NONE;

}
exports.InternalColumn.prototype.getOperatorName = function() {
    return '[InternalColumn]';
}
exports.InternalColumn.prototype.printTree = function(indent) {
    console.log(indent, this.getOperatorName() + ' ' + this.tableName + '.' + this.name);
}
exports.InternalColumn.prototype.createContracts = function() {
    console.log(this.getOperatorName(), "create contract");
    // not needed?
}
exports.InternalColumn.prototype.improveContract = function(contractParent, suggestedContracts) {
    console.log("InternalColumn.improveContract()", this.tableName, this.name);
    return this;
}
exports.InternalColumn.prototype.getType = function() {
    //return this.type;
    return "SQL_COLUMN_VARIABLE";
}
exports.InternalColumn.prototype.getValue = function() {
    return null;
}
exports.InternalColumn.prototype.printPlan = function() {
    console.log(this.getOperatorName() + ' ' + this.tableName + '.' + this.name);
}
