// node --trace-uncaught sql_server.js

//const http = require("http");
const express = require('express');
//const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
//var cors = require('cors');

const CONFIG = require("./config");
const { SERVER: { PORT } } = CONFIG;

const fs = require('fs');
//const path = require('path');
//var SQL_GRAMMAR;
fs.readFile('sqlgrammar.json', 'utf8', function (err, data) {
    if (err) throw err;
    SQL_GRAMMAR = JSON.parse(data);
});

const PARSER_SQL = require("./parser_SQL");
const VALIDATOR = require("./validator");
const OPTIMIZER = require("./optimizer");
const DBMS = require("./dbms");

const app = express();
const port = process.argv[2] || PORT;

app.use(bodyParser.urlencoded({extended: true}));


app.get('/', function (request, response) {
    console.log('GET request');
    response.send('GET /')
});


app.post('/query', function (request, response) {
    //console.log('QUERY request body=' + request.body);
    //console.log("QUERY request body=" + JSON.stringify(request.body));
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    var cmd = '';
    for (var item in request.body) {
	//console.log("CMD item:" + item);
	var tags = null;
	try {
	    tags = JSON.parse(item);
	} catch(e) {
	    console.log('JSON parse error for ' + item);
	    response.status(200);
	    response.send('JSON parse error: ' + item);
	    return;
	}
        for (var key in tags) {
	    var value = "" + tags[key];
	    if (key == "cmd") {
		cmd = value;
	    } else {
		console.log("unknown param " + key);
	    }
        }
    }
    //console.log('SQL cmd=' + cmd);
    
    var context;
    let queryTree;
    let planTree;
    try {
	context = PARSER_SQL.parse(SQL_GRAMMAR, cmd);
	checkedContext = VALIDATOR.CheckQueryContext(context);
	planTree = OPTIMIZER.optimize(checkedContext);
    } catch (err) {
	console.log(err);
	response.status(200);
	response.send("Query error: " + err.toString());
	return;
    }

    try {
	var answer = DBMS.exec(planTree);
	response.status(200);
	response.send(answer);
	//console.log("ANSWER=" + answer);
    } catch (err) {
	console.log(err);
	response.status(200);
	response.send("Exec error: " + err.toString());
	return;
    }
});


const server = app.listen(port, function() {
    //var host = server.address().address;
    console.log("HODAG server listening on port", port);
    DBMS.init();
});
