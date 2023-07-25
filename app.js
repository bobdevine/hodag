function ajaxRequest() {
    if (window.XMLHttpRequest) // Mozilla, Chrome, Safari, etc
        return new XMLHttpRequest();
    else if (window.ActiveXObject) { // older IE
        var activexmodes = ["Msxml2.XMLHTTP", "Microsoft.XMLHTTP"];
        for (var i=0; i<activexmodes.length; i++) {
            try {
                var activex = new ActiveXObject(activexmodes[i]);
                return activex;
            }
            catch(e){ }
        }
    }

    return null;
}

var timeStart;

function sendToServer() {
    //window.alert("sendToServer");
    var queryText = document.getElementById('commandTextarea');
    //window.alert("queryText=" + queryText.value);

    timeStart = Date.now();
    // performance.now()

    if (queryText.value == "")
    { 
	var queryResult = document.getElementById('resultTextarea');
	queryResult.innerHTML = "Enter a SQL command";
	return false;
    }
    var xmlhttp = new ajaxRequest();
    xmlhttp.onreadystatechange = QueryCallback;
    xmlhttp.open("POST", "http://localhost:8080/query", true);
    xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    //xmlhttp.setRequestHeader("Content-type", "application/json;charset=UTF-8");
    var str = queryText.value;
    str = str.replace(/(\r\n|\n|\r|\t)/gm, " ");
    str = str.replace(/\"/gm, "'");
    var body = JSON.stringify({ "cmd" : encodeURIComponent(str) } );
    xmlhttp.send(body);

    return false;
}

function QueryCallback (data) {
    //window.alert("OnReadyState state=" + this.readyState + " status=" + this.status + " text=" + this.responseText);
    var queryResult = document.getElementById('QueryResult');
    if (this.readyState == 4) {
        if (this.status == 200) {
	    var queryElapsedTime = document.getElementById('QueryElapsedTime');

	    //queryElapsedTime.innerHTML = "foo";
	    let diff = Date.now() - timeStart; // milliseconds
	    queryElapsedTime.innerHTML = "" + diff + " msec";

	    if (this.responseText.charAt(0) != "{") {
		queryResult.innerHTML = this.responseText;
		return;
	    }
	    //alert(this.responseText);
	    var answer = {};
	    try {
		answer = JSON.parse(this.responseText);
	    } catch(err) {
		alert(this.responseText);
		queryResult.innerHTML = err;
	    }
	    var formattedTable = '<table border="1" style="border-collapse:collapse;">';
	    formattedTable += "<thead>";
	    formattedTable += "<tr>";
	    for (var i=0; i<answer.headers.length; i++) {
		var colname = answer.headers[i];
		formattedTable += '<th>' + colname + '</th>';
	    }
	    formattedTable += "</tr>";
	    formattedTable += "</thead>";

	    for (var i=0; i<answer.rows.length; i++) {
		formattedTable += "<tr>";
		for (var j=0; j<answer.headers.length; j++) {
		    formattedTable += '<td>' + answer.rows[i][j] + '</td>';
		}
		formattedTable += "</tr>";
	    }
	    formattedTable += "</table>";
	    
	    if (answer.rows.length == 0) {
		formattedTable += "<br>(0 rows)";
	    } else if (answer.rows.length == 1) {
		formattedTable += "<br>(1 row)";
	    } else {
		formattedTable += "<br>(" +  answer.rows.length + " rows)";
	    }
	    //alert(formattedTable);
	    queryResult.innerHTML = formattedTable;
	} else if (this.status == 0) {
	    queryResult.innerHTML = "Server is not reachable."
	} else {
	    queryResult.innerHTML = "Command failed, server status code: " + this.status;
	}
    }
}

